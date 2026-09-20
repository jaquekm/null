import { describe, expect, it } from "vitest";
import { buildBirthdayReminders, type BirthdayRule, type ContactForBirthdayRule } from "./build-birthday-reminders";

const timezone = "America/Sao_Paulo";
const now = new Date("2026-06-01T12:00:00.000Z");

function fakeContact(overrides: Partial<ContactForBirthdayRule> = {}): ContactForBirthdayRule {
  return { id: "contact-1", name: "Beatriz Souza", nickname: "Bia", birthday: "1990-06-15", ...overrides };
}

function fakeRule(overrides: Partial<BirthdayRule> = {}): BirthdayRule {
  return { id: "rule-1", channel: "auto", messageTemplate: "Parabéns, {{nome}}! 🎉", config: {}, ...overrides };
}

describe("buildBirthdayReminders", () => {
  it("sem sendToContact: só o lembrete pro dono", () => {
    const result = buildBirthdayReminders([fakeContact()], fakeRule(), timezone, now);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sourceType: "birthday",
      sourceId: "contact-1",
      recipientType: "me",
      channel: "push",
      contactIds: [],
    });
    expect(result[0]!.messageTemplate).toContain("{{contato}}");
    expect(result[0]!.messageTemplate).toContain("Parabéns, {{nome}}! 🎉");
    expect(result[0]!.variables).toEqual({ contato: "Bia", nome: "Bia", nome_completo: "Beatriz Souza", data: "15/06/2026" });
  });

  it("com sendToContact: gera os dois, com source_type diferentes (mesmo source_id)", () => {
    const result = buildBirthdayReminders([fakeContact()], fakeRule({ config: { sendToContact: true } }), timezone, now);
    expect(result).toHaveLength(2);

    const toMe = result.find((r) => r.sourceType === "birthday")!;
    const toContact = result.find((r) => r.sourceType === "birthday_contact")!;

    expect(toMe.sourceId).toBe("contact-1");
    expect(toContact.sourceId).toBe("contact-1");
    expect(toContact).toMatchObject({ recipientType: "contacts", contactIds: ["contact-1"], messageTemplate: "Parabéns, {{nome}}! 🎉" });
  });

  it("sem apelido: usa o nome completo como {{contato}}/{{nome}}", () => {
    const result = buildBirthdayReminders([fakeContact({ nickname: null })], fakeRule(), timezone, now);
    expect(result[0]!.variables.contato).toBe("Beatriz Souza");
  });

  it("aniversário fora da janela de 30 dias: não gera", () => {
    const result = buildBirthdayReminders([fakeContact({ birthday: "1990-12-25" })], fakeRule(), timezone, now);
    expect(result).toEqual([]);
  });

  it("contato sem data de aniversário: não gera", () => {
    const result = buildBirthdayReminders([fakeContact({ birthday: null })], fakeRule(), timezone, now);
    expect(result).toEqual([]);
  });

  it("vários contatos: um conjunto de lembretes por contato", () => {
    const result = buildBirthdayReminders(
      [fakeContact({ id: "contact-1", birthday: "1990-06-10" }), fakeContact({ id: "contact-2", birthday: "1990-06-20" })],
      fakeRule({ config: { sendToContact: true } }),
      timezone,
      now,
    );
    expect(result).toHaveLength(4);
  });
});
