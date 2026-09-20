import { describe, expect, it } from "vitest";
import { buildEventBeforeReminders, type ContactForEventRule, type EventBeforeRule, type EventForRule } from "./build-event-before-reminders";

const timezone = "America/Sao_Paulo";
const appUrl = "https://hub.example";
const now = new Date("2026-01-01T00:00:00.000Z");

function fakeEvent(overrides: Partial<EventForRule> = {}): EventForRule {
  return {
    id: "event-1",
    title: "Reunião com cliente",
    starts_at: "2026-01-10T15:00:00.000Z", // 12:00 em São Paulo
    status: "confirmed",
    attendees: [{ email: "bia@example.com" }],
    item_id: null,
    conference_url: "https://meet.example/x",
    ...overrides,
  };
}

function fakeContact(overrides: Partial<ContactForEventRule> = {}): ContactForEventRule {
  return { id: "contact-1", email: "bia@example.com", relationship: "client", whatsapp_opt_in: true, email_opt_in: false, ...overrides };
}

function fakeRule(overrides: Partial<EventBeforeRule> = {}): EventBeforeRule {
  return { id: "rule-1", recipientType: "contacts", channel: "auto", messageTemplate: "Oi {{nome}}, sua reunião é {{data}} às {{hora}}.", config: {}, ...overrides };
}

describe("buildEventBeforeReminders — recipientType 'contacts'", () => {
  it("gera lembrete pro contato correspondente, com data/hora do evento (não da entrega)", () => {
    const result = buildEventBeforeReminders([fakeEvent()], [fakeContact()], fakeRule(), timezone, now, appUrl);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sourceType: "event",
      sourceId: "event-1",
      recipientType: "contacts",
      contactIds: ["contact-1"],
      variables: { link: "https://meet.example/x", data: "10/01/2026", hora: "12:00" },
    });
    // 24h antes de 2026-01-10T15:00Z
    expect(result[0]!.sendAt).toBe("2026-01-09T15:00:00.000Z");
  });

  it("hoursBefore customizado", () => {
    const result = buildEventBeforeReminders([fakeEvent()], [fakeContact()], fakeRule({ config: { hoursBefore: 2 } }), timezone, now, appUrl);
    expect(result[0]!.sendAt).toBe("2026-01-10T13:00:00.000Z");
  });

  it("evento cancelado: não gera", () => {
    const result = buildEventBeforeReminders([fakeEvent({ status: "cancelled" })], [fakeContact()], fakeRule(), timezone, now, appUrl);
    expect(result).toEqual([]);
  });

  it("evento sem convidados: não gera", () => {
    const result = buildEventBeforeReminders([fakeEvent({ attendees: [] })], [fakeContact()], fakeRule(), timezone, now, appUrl);
    expect(result).toEqual([]);
  });

  it("contato sem nenhum opt-in: não é elegível", () => {
    const result = buildEventBeforeReminders(
      [fakeEvent()],
      [fakeContact({ whatsapp_opt_in: false, email_opt_in: false })],
      fakeRule(),
      timezone,
      now,
      appUrl,
    );
    expect(result).toEqual([]);
  });

  it("onlyRelationships filtra por relação", () => {
    const result = buildEventBeforeReminders(
      [fakeEvent()],
      [fakeContact({ relationship: "friend" })],
      fakeRule({ config: { onlyRelationships: ["client"] } }),
      timezone,
      now,
      appUrl,
    );
    expect(result).toEqual([]);
  });

  it("send_at já passado: não gera (evento muito próximo pro hoursBefore configurado)", () => {
    const result = buildEventBeforeReminders(
      [fakeEvent({ starts_at: "2026-01-01T01:00:00.000Z" })], // 1h depois de `now`
      [fakeContact()],
      fakeRule({ config: { hoursBefore: 24 } }),
      timezone,
      now,
      appUrl,
    );
    expect(result).toEqual([]);
  });

  it("múltiplos contatos elegíveis no mesmo evento: um lembrete só, com todos os contact_ids", () => {
    const result = buildEventBeforeReminders(
      [fakeEvent({ attendees: [{ email: "bia@example.com" }, { email: "carlos@example.com" }] })],
      [fakeContact(), fakeContact({ id: "contact-2", email: "carlos@example.com" })],
      fakeRule(),
      timezone,
      now,
      appUrl,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.contactIds.sort()).toEqual(["contact-1", "contact-2"]);
  });
});

describe("buildEventBeforeReminders — recipientType 'me'", () => {
  const meRule = fakeRule({ recipientType: "me", channel: "auto", config: { minutesBefore: 15 } });

  it("não exige convidados", () => {
    const result = buildEventBeforeReminders([fakeEvent({ attendees: [] })], [], meRule, timezone, now, appUrl);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ recipientType: "me", contactIds: [] });
    expect(result[0]!.sendAt).toBe("2026-01-10T14:45:00.000Z"); // 15min antes de 15:00Z
  });

  it("com nota de reunião (item_id): link pra nota, não pro Meet", () => {
    const result = buildEventBeforeReminders([fakeEvent({ item_id: "item-1" })], [], meRule, timezone, now, appUrl);
    expect(result[0]!.variables.link).toBe("https://hub.example/itens/item-1");
  });

  it("sem nota ainda: link pro Meet como fallback", () => {
    const result = buildEventBeforeReminders([fakeEvent({ item_id: null })], [], meRule, timezone, now, appUrl);
    expect(result[0]!.variables.link).toBe("https://meet.example/x");
  });

  it("sem nota nem Meet: link vazio", () => {
    const result = buildEventBeforeReminders([fakeEvent({ item_id: null, conference_url: null })], [], meRule, timezone, now, appUrl);
    expect(result[0]!.variables.link).toBe("");
  });
});
