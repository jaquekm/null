import { z } from "zod";
import { RELATIONSHIPS } from "@/features/contacts/schemas";

export const REMINDER_CHANNELS = ["whatsapp", "email", "push", "auto"] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const REMINDER_CHANNEL_LABELS: Record<ReminderChannel, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  push: "Push",
  auto: "Automático (canal preferido do contato)",
};

export const REMINDER_RECIPIENT_TYPES = ["me", "contacts"] as const;
export type ReminderRecipientType = (typeof REMINDER_RECIPIENT_TYPES)[number];

const weekdaySchema = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);

/** Espelha `RecurrencePreset` (`lib/recurrence.ts`) em Zod, pra validar o que vem do formulário. */
export const recurrencePresetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("once") }),
  z.object({ kind: z.literal("daily") }),
  z.object({ kind: z.literal("weekdays") }),
  z.object({ kind: z.literal("weekly"), days: z.array(weekdaySchema).min(1, "Escolha ao menos um dia da semana.") }),
  z.object({ kind: z.literal("monthly_day"), day: z.coerce.number().int().min(1, "Dia inválido.").max(31, "Dia inválido.") }),
  z.object({ kind: z.literal("monthly_last_weekday"), day: weekdaySchema }),
  z.object({ kind: z.literal("yearly") }),
  z.object({ kind: z.literal("custom"), rrule: z.string().trim().min(1, "RRULE não pode ser vazia.") }),
]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export const reminderInputSchema = z
  .object({
    title: z.string().trim().min(1, "Título é obrigatório."),
    messageTemplate: z.string().trim().min(1, "Mensagem é obrigatória."),
    channel: z.enum(REMINDER_CHANNELS).default("auto"),
    recipientType: z.enum(REMINDER_RECIPIENT_TYPES).default("me"),
    contactIds: z.array(z.string().uuid()).default([]),
    date: isoDate,
    time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida."),
    timezone: z.string().trim().min(1).default("America/Sao_Paulo"),
    recurrence: recurrencePresetSchema.default({ kind: "once" }),
    endsAt: isoDate.optional().or(z.literal("")),
    variables: z.record(z.string(), z.string()).default({}),
    itemId: z.string().uuid().nullable().optional(),
    sourceType: z.string().trim().optional(),
    sourceId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.recipientType === "contacts" && data.contactIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["contactIds"], message: "Escolha ao menos um contato." });
    }
  });

export type ReminderInput = z.infer<typeof reminderInputSchema>;

export const REMINDER_STATUSES = ["scheduled", "paused", "completed", "canceled"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

/** `split_open` (enunciado) é 4.9, ainda não implementado — `bill_due` chegou na 4.8. */
export const REMINDER_RULE_KINDS = ["event_before", "birthday", "item_date_field", "bill_due"] as const;
export type ReminderRuleKind = (typeof REMINDER_RULE_KINDS)[number];

/** `config` é jsonb livre por natureza (cada `kind` usa campos diferentes) — o formulário monta a forma certa por `kind`; só os campos em comum a todo `kind` (nome, mensagem) são validados de forma estrita aqui. */
export const reminderRuleInputSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório."),
  kind: z.enum(REMINDER_RULE_KINDS),
  channel: z.enum(REMINDER_CHANNELS).default("auto"),
  recipientType: z.enum(REMINDER_RECIPIENT_TYPES).default("contacts"),
  messageTemplate: z.string().trim().min(1, "Mensagem é obrigatória."),
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({}),
});

export type ReminderRuleInput = z.infer<typeof reminderRuleInputSchema>;

export const eventBeforeRuleConfigSchema = z.object({
  hoursBefore: z.coerce.number().int().positive().optional(),
  minutesBefore: z.coerce.number().int().positive().optional(),
  onlyRelationships: z.array(z.enum(RELATIONSHIPS)).optional(),
});

export const birthdayRuleConfigSchema = z.object({
  sendToContact: z.boolean().optional(),
});

export const itemDateFieldRuleConfigSchema = z.object({
  typeId: z.string().uuid().optional(),
  fieldKey: z.string().optional(),
  fieldType: z.enum(["date", "datetime"]).optional(),
  daysBefore: z.coerce.number().int().positive().optional(),
});

export const billDueRuleConfigSchema = z.object({
  daysBefore: z.coerce.number().int().positive().optional(),
});
