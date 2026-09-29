import { describe, expect, it } from "vitest";
import { eventAlertLabel, eventAlertState, type EventAlertRuleRow } from "./event-alert";

const rule = (patch: Partial<EventAlertRuleRow>): EventAlertRuleRow => ({
  id: "r1",
  kind: "event_before",
  recipient_type: "me",
  channel: "push",
  enabled: true,
  config: { minutesBefore: 10 },
  created_at: "2026-09-01T00:00:00Z",
  ...patch,
});

describe("eventAlertLabel", () => {
  it.each([
    [10, "10 minutos antes"],
    [30, "30 minutos antes"],
    [60, "1 hora antes"],
    [120, "2 horas antes"],
    [1440, "1 dia antes"],
    [2880, "2 dias antes"],
  ])("%i → %s", (minutes, label) => {
    expect(eventAlertLabel(minutes)).toBe(label);
  });
});

describe("eventAlertState", () => {
  it("sem regra: desligado, por notificação", () => {
    expect(eventAlertState([])).toEqual({ ruleId: null, minutesBefore: null, channel: "push" });
  });

  it("lê minutos e canal da regra pra mim", () => {
    expect(eventAlertState([rule({ channel: "email" })])).toEqual({ ruleId: "r1", minutesBefore: 10, channel: "email" });
  });

  it("regra desligada = aviso desligado, mas guarda o id pra religar", () => {
    expect(eventAlertState([rule({ enabled: false })])).toEqual({ ruleId: "r1", minutesBefore: null, channel: "push" });
  });

  it("ignora a regra pros participantes e usa a mais antiga pra mim", () => {
    const state = eventAlertState([
      rule({ id: "contatos", recipient_type: "contacts", created_at: "2026-01-01T00:00:00Z" }),
      rule({ id: "nova", created_at: "2026-09-10T00:00:00Z", config: { minutesBefore: 60 } }),
      rule({ id: "antiga", created_at: "2026-09-02T00:00:00Z", config: {} }),
    ]);
    expect(state).toEqual({ ruleId: "antiga", minutesBefore: 30, channel: "push" });
  });

  it("canal automático ou WhatsApp vira notificação (a dona não tem WhatsApp cadastrado)", () => {
    expect(eventAlertState([rule({ channel: "auto" })]).channel).toBe("push");
    expect(eventAlertState([rule({ channel: "whatsapp" })]).channel).toBe("push");
  });
});
