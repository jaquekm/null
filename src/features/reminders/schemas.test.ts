import { describe, expect, it } from "vitest";
import { reminderInputSchema, reminderRuleInputSchema } from "./schemas";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Ligar pro cliente",
    messageTemplate: "Oi {{nome}}, tudo bem?",
    channel: "whatsapp",
    recipientType: "me",
    contactIds: [],
    date: "2026-02-01",
    time: "09:00",
    timezone: "America/Sao_Paulo",
    recurrence: { kind: "once" },
    variables: {},
    ...overrides,
  };
}

describe("reminderInputSchema", () => {
  it("aceita um lembrete único válido", () => {
    expect(reminderInputSchema.safeParse(baseInput()).success).toBe(true);
  });

  it("recipientType 'contacts' sem contactIds: erro no campo contactIds", () => {
    const result = reminderInputSchema.safeParse(baseInput({ recipientType: "contacts", contactIds: [] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.contactIds).toBeTruthy();
    }
  });

  it("recipientType 'contacts' com contactIds: válido", () => {
    const result = reminderInputSchema.safeParse(
      baseInput({ recipientType: "contacts", contactIds: ["11111111-1111-4111-8111-111111111111"] }),
    );
    expect(result.success).toBe(true);
  });

  it("título vazio: inválido", () => {
    expect(reminderInputSchema.safeParse(baseInput({ title: "  " })).success).toBe(false);
  });

  it("recorrência 'weekly' sem dias: inválido", () => {
    expect(reminderInputSchema.safeParse(baseInput({ recurrence: { kind: "weekly", days: [] } })).success).toBe(false);
  });

  it("recorrência 'weekly' com dias: válido", () => {
    expect(reminderInputSchema.safeParse(baseInput({ recurrence: { kind: "weekly", days: ["MO", "WE"] } })).success).toBe(true);
  });

  it("recorrência 'monthly_last_weekday': válido", () => {
    expect(reminderInputSchema.safeParse(baseInput({ recurrence: { kind: "monthly_last_weekday", day: "FR" } })).success).toBe(true);
  });

  it("recorrência 'custom' sem rrule: inválido", () => {
    expect(reminderInputSchema.safeParse(baseInput({ recurrence: { kind: "custom", rrule: "" } })).success).toBe(false);
  });

  it("data em formato errado: inválido", () => {
    expect(reminderInputSchema.safeParse(baseInput({ date: "01/02/2026" })).success).toBe(false);
  });
});

function baseRuleInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Lembrete de reunião para participantes",
    kind: "event_before",
    channel: "auto",
    recipientType: "contacts",
    messageTemplate: "Oi {{nome}}, sua reunião é {{data}} às {{hora}}.",
    enabled: true,
    config: { hoursBefore: 24 },
    ...overrides,
  };
}

describe("reminderRuleInputSchema", () => {
  it("aceita uma regra válida", () => {
    expect(reminderRuleInputSchema.safeParse(baseRuleInput()).success).toBe(true);
  });

  it("nome vazio: inválido", () => {
    expect(reminderRuleInputSchema.safeParse(baseRuleInput({ name: "  " })).success).toBe(false);
  });

  it("kind fora do enum: inválido", () => {
    expect(reminderRuleInputSchema.safeParse(baseRuleInput({ kind: "nao_existe" })).success).toBe(false);
  });

  it("config vazio (sem valores default ainda escolhidos): ainda válido — os builders usam padrões", () => {
    expect(reminderRuleInputSchema.safeParse(baseRuleInput({ config: {} })).success).toBe(true);
  });

  it("mensagem vazia: inválido", () => {
    expect(reminderRuleInputSchema.safeParse(baseRuleInput({ messageTemplate: "  " })).success).toBe(false);
  });
});
