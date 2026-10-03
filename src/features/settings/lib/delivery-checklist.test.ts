import { describe, expect, it } from "vitest";
import { deliveryChecklist } from "./delivery-checklist";

const now = new Date("2026-10-03T19:00:00Z");
const base = { lastTickAt: null, now, pushDevices: 0, ownerWhatsapp: null, whatsappChannelReady: false };

describe("deliveryChecklist", () => {
  it("nada configurado: os três itens dizem o que fazer", () => {
    const checks = deliveryChecklist(base);
    expect(checks.map((c) => [c.key, c.ok])).toEqual([
      ["scheduler", false],
      ["push", false],
      ["whatsapp", false],
    ]);
    expect(checks[0]!.fix).toContain("Vault");
    expect(checks[0]!.fix).toContain("não mande em chat");
    expect(checks[1]!.fix).toContain("Ativar neste aparelho");
    expect(checks[2]!.fix).toContain("Seu WhatsApp");
  });

  it("tudo certo: sem instruções", () => {
    const checks = deliveryChecklist({ lastTickAt: "2026-10-03T18:59:00Z", now, pushDevices: 2, ownerWhatsapp: "+5511999990000", whatsappChannelReady: true });
    expect(checks.every((c) => c.ok && c.fix === null)).toBe(true);
    expect(checks[1]!.title).toBe("Notificação ligada em 2 aparelhos");
  });

  it("agendador que parou há mais de 10 min é diferente de nunca ligado", () => {
    const stale = deliveryChecklist({ ...base, lastTickAt: "2026-10-03T18:30:00Z" })[0]!;
    expect(stale.ok).toBe(false);
    expect(stale.fix).toContain("parou");
  });

  it("número cadastrado mas N8N desligado", () => {
    expect(deliveryChecklist({ ...base, ownerWhatsapp: "+5511999990000" })[2]!.fix).toContain("N8N");
  });
});
