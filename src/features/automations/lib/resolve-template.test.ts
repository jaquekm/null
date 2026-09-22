import { describe, expect, it } from "vitest";
import { resolveTemplateValue } from "./resolve-template";

const TODAY = new Date("2026-09-22T12:00:00Z");

describe("resolveTemplateValue", () => {
  it("{{today}} vira a data de hoje (AAAA-MM-DD)", () => {
    expect(resolveTemplateValue("{{today}}", { today: TODAY })).toBe("2026-09-22");
  });

  it("{{today+7d}} soma dias", () => {
    expect(resolveTemplateValue("{{today+7d}}", { today: TODAY })).toBe("2026-09-29");
  });

  it("{{today-3d}} subtrai dias", () => {
    expect(resolveTemplateValue("{{today-3d}}", { today: TODAY })).toBe("2026-09-19");
  });

  it("valor não-string passa intacto", () => {
    expect(resolveTemplateValue(42, { today: TODAY })).toBe(42);
    expect(resolveTemplateValue(true, { today: TODAY })).toBe(true);
  });

  it("string livre com {{campo}} interpola a partir do item", () => {
    const result = resolveTemplateValue("Follow-up: {{title}} ({{stage}})", {
      today: TODAY,
      item: { title: "Oportunidade X", properties: { stage: "won" } },
    });
    expect(result).toBe("Follow-up: Oportunidade X (won)");
  });

  it("token sem valor correspondente fica como está", () => {
    const result = resolveTemplateValue("{{inexistente}}", { today: TODAY, item: { title: "X", properties: {} } });
    expect(result).toBe("{{inexistente}}");
  });

  it("string sem template nem item: passa intacta", () => {
    expect(resolveTemplateValue("texto fixo", { today: TODAY })).toBe("texto fixo");
  });

  it("{{today+<campo>d}} soma o número de dias do campo do item (5.10: revisão de SOP)", () => {
    const result = resolveTemplateValue("{{today+review_every_daysd}}", {
      today: TODAY,
      item: { title: "SOP", properties: { review_every_days: 90 } },
    });
    expect(result).toBe("2026-12-21");
  });

  it("{{today+<campo>d}} sem item: fica como está", () => {
    expect(resolveTemplateValue("{{today+review_every_daysd}}", { today: TODAY })).toBe("{{today+review_every_daysd}}");
  });

  it("{{today+<campo>d}} com campo ausente ou não numérico: fica como está", () => {
    const result = resolveTemplateValue("{{today+review_every_daysd}}", {
      today: TODAY,
      item: { title: "SOP", properties: {} },
    });
    expect(result).toBe("{{today+review_every_daysd}}");
  });
});
