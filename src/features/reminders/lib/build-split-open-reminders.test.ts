import { describe, expect, it } from "vitest";
import { buildSplitOpenReminders, type ContactForSplitOpenRule, type ShareForOpenRule, type SplitForOpenRule, type SplitOpenRule } from "./build-split-open-reminders";

const CREATED_AT = "2026-01-01T00:00:00.000Z";

function fakeSplit(overrides: Partial<SplitForOpenRule> = {}): SplitForOpenRule {
  return { id: "split-1", title: "Jantar", created_at: CREATED_AT, status: "open", ...overrides };
}

function fakeShare(overrides: Partial<ShareForOpenRule> = {}): ShareForOpenRule {
  return { id: "share-1", split_id: "split-1", contact_id: "ana", share_cents: 5000, settled_cents: 0, ...overrides };
}

function fakeContact(overrides: Partial<ContactForSplitOpenRule> = {}): ContactForSplitOpenRule {
  return { id: "ana", whatsapp_opt_in: true, email_opt_in: false, ...overrides };
}

function fakeRule(overrides: Partial<SplitOpenRule> = {}): SplitOpenRule {
  return { id: "rule-1", recipientType: "contacts", channel: "auto", messageTemplate: "Oi {{nome}}, {{titulo}} está em aberto há {{dias}} dias: {{valor}}.", config: {}, ...overrides };
}

describe("buildSplitOpenReminders — recipientType 'contacts'", () => {
  it("menos de 7 dias em aberto (padrão): não gera ainda", () => {
    const now = new Date("2026-01-04T00:00:00.000Z"); // 3 dias
    const result = buildSplitOpenReminders([fakeSplit()], [fakeShare()], [fakeContact()], fakeRule(), now);
    expect(result).toEqual([]);
  });

  it("exatamente 7 dias em aberto: gera o primeiro lembrete", () => {
    const now = new Date("2026-01-08T02:00:00.000Z"); // 7 dias e 2h
    const result = buildSplitOpenReminders([fakeSplit()], [fakeShare()], [fakeContact()], fakeRule(), now);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sourceType: "split_open",
      sourceId: "share-1",
      recipientType: "contacts",
      contactIds: ["ana"],
      variables: { valor: "R$ 50,00", dias: "7" },
    });
    expect(result[0]!.sendAt).toBe("2026-01-08T00:00:00.000Z");
  });

  it("14+ dias em aberto: o lembrete cai no múltiplo de 7 mais recente (não avança 1 a 1)", () => {
    const now = new Date("2026-01-16T00:00:00.000Z"); // 15 dias
    const result = buildSplitOpenReminders([fakeSplit()], [fakeShare()], [fakeContact()], fakeRule(), now);
    expect(result[0]!.sendAt).toBe("2026-01-15T00:00:00.000Z"); // 14 dias depois da criação
    expect(result[0]!.variables.dias).toBe("15");
  });

  it("intervalo customizado (everyDays: 3)", () => {
    const now = new Date("2026-01-05T00:00:00.000Z"); // 4 dias
    const result = buildSplitOpenReminders([fakeSplit()], [fakeShare()], [fakeContact()], fakeRule({ config: { everyDays: 3 } }), now);
    expect(result[0]!.sendAt).toBe("2026-01-04T00:00:00.000Z"); // 1 período de 3 dias
  });

  it("parte já quitada (settledCents >= shareCents): não gera", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const result = buildSplitOpenReminders([fakeSplit()], [fakeShare({ settled_cents: 5000 })], [fakeContact()], fakeRule(), now);
    expect(result).toEqual([]);
  });

  it("parte parcialmente quitada: usa só o restante no valor da variável", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const result = buildSplitOpenReminders([fakeSplit()], [fakeShare({ settled_cents: 2000 })], [fakeContact()], fakeRule(), now);
    expect(result[0]!.variables.valor).toBe("R$ 30,00");
  });

  it("divisão não está mais 'open' (settled/canceled): não gera", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const settled = buildSplitOpenReminders([fakeSplit({ status: "settled" })], [fakeShare()], [fakeContact()], fakeRule(), now);
    const canceled = buildSplitOpenReminders([fakeSplit({ status: "canceled" })], [fakeShare()], [fakeContact()], fakeRule(), now);
    expect(settled).toEqual([]);
    expect(canceled).toEqual([]);
  });

  it("parte é minha própria (contactId nulo): não gera pra 'contacts'", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const result = buildSplitOpenReminders([fakeSplit()], [fakeShare({ contact_id: null })], [fakeContact()], fakeRule(), now);
    expect(result).toEqual([]);
  });

  it("contato sem nenhum opt-in: não é elegível", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const result = buildSplitOpenReminders([fakeSplit()], [fakeShare()], [fakeContact({ whatsapp_opt_in: false, email_opt_in: false })], fakeRule(), now);
    expect(result).toEqual([]);
  });
});

describe("buildSplitOpenReminders — recipientType 'me'", () => {
  const meRule = fakeRule({ recipientType: "me" });

  it("minha própria parte em aberto: gera, sem contato vinculado", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const result = buildSplitOpenReminders([fakeSplit()], [fakeShare({ contact_id: null })], [], meRule, now);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ recipientType: "me", contactIds: [] });
  });

  it("parte de um contato: não gera pra 'me' (só a minha própria)", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const result = buildSplitOpenReminders([fakeSplit()], [fakeShare({ contact_id: "ana" })], [fakeContact()], meRule, now);
    expect(result).toEqual([]);
  });
});
