"use server";

import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { dispatchReminderOccurrence } from "./lib/dispatch";
import { buildRRuleString } from "./lib/recurrence";
import { findUnknownTemplateVariables } from "./lib/render-template";
import { reminderInputSchema, reminderRuleInputSchema } from "./schemas";

const GENERIC_ERROR = "Não foi possível salvar o lembrete. Tente de novo.";
const REMINDERS_PATH = "/lembretes";
const REMINDER_RULES_PATH = "/lembretes/regras";

function unknownVariablesError(messageTemplate: string, variables: Record<string, string>): Result<never> | null {
  const unknown = findUnknownTemplateVariables(messageTemplate, Object.keys(variables));
  if (unknown.length === 0) return null;
  const list = unknown.map((name) => `{{${name}}}`).join(", ");
  return fail(`Variável desconhecida no template: ${list}.`, { messageTemplate: [`Variável desconhecida: ${list}`] });
}

function buildReminderFields(parsed: z.infer<typeof reminderInputSchema>) {
  const sendAt = fromZonedTime(`${parsed.date}T${parsed.time}:00`, parsed.timezone);
  const rrule = buildRRuleString(parsed.recurrence, sendAt, parsed.timezone);
  const endsAt = parsed.endsAt ? fromZonedTime(`${parsed.endsAt}T23:59:59`, parsed.timezone) : null;

  return {
    title: parsed.title,
    message_template: parsed.messageTemplate,
    channel: parsed.channel,
    recipient_type: parsed.recipientType,
    contact_ids: parsed.recipientType === "contacts" ? parsed.contactIds : [],
    send_at: sendAt.toISOString(),
    rrule,
    timezone: parsed.timezone,
    ends_at: endsAt ? endsAt.toISOString() : null,
    variables: parsed.variables,
  };
}

/** Criar lembrete (3.8) — inclui o fluxo "Lembrar sobre isto" (`itemId`/`sourceType`/`sourceId` no input). */
export async function createReminder(input: z.input<typeof reminderInputSchema>): Promise<Result<{ id: string }>> {
  const parsed = reminderInputSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const variablesError = unknownVariablesError(parsed.data.messageTemplate, parsed.data.variables);
  if (variablesError) return variablesError;

  const { supabase, user } = await requireOwner();

  const { data, error } = await supabase
    .from("reminders")
    .insert({
      owner_id: user.id,
      ...buildReminderFields(parsed.data),
      item_id: parsed.data.itemId ?? null,
      source_type: parsed.data.sourceType ?? null,
      source_id: parsed.data.sourceId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath(REMINDERS_PATH);
  return ok({ id: data.id });
}

/** Editar lembrete (3.8) — recalcula `send_at`/`rrule`/`ends_at`; não mexe em `status` (use pausar/retomar/cancelar). */
export async function updateReminder(id: string, input: z.input<typeof reminderInputSchema>): Promise<Result<null>> {
  const parsed = reminderInputSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const variablesError = unknownVariablesError(parsed.data.messageTemplate, parsed.data.variables);
  if (variablesError) return variablesError;

  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("reminders")
    .update(buildReminderFields(parsed.data))
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) return fail(GENERIC_ERROR);

  revalidatePath(REMINDERS_PATH);
  return ok(null);
}

async function setReminderStatus(id: string, status: "paused" | "scheduled" | "canceled"): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("reminders").update({ status }).eq("id", id).eq("owner_id", user.id);
  if (error) return fail("Não foi possível atualizar o lembrete. Tente de novo.");
  revalidatePath(REMINDERS_PATH);
  return ok(null);
}

export async function pauseReminder(id: string): Promise<Result<null>> {
  return setReminderStatus(id, "paused");
}

export async function resumeReminder(id: string): Promise<Result<null>> {
  return setReminderStatus(id, "scheduled");
}

export async function cancelReminder(id: string): Promise<Result<null>> {
  return setReminderStatus(id, "canceled");
}

/** "Enviar agora" (3.8, com confirmação na UI) — processa a ocorrência imediatamente, ignorando o horário silencioso. */
export async function sendReminderNow(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { data: reminder, error } = await supabase.from("reminders").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (error || !reminder) return fail("Lembrete não encontrado.");
  if (reminder.status === "completed" || reminder.status === "canceled") {
    return fail("Esse lembrete já foi concluído ou cancelado.");
  }

  await dispatchReminderOccurrence(supabase, user.id, { ...reminder, send_at: new Date().toISOString() }, { bypassQuietHours: true });

  revalidatePath(REMINDERS_PATH);
  return ok(null);
}

/** `{{contato}}` (3.10, regra "Aniversários") não é uma variável fixa do template (`render-template.ts`) — só existe pra essa regra. */
const RULE_EXTRA_TEMPLATE_VARS: Record<string, string[]> = { birthday: ["contato"] };

function ruleUnknownVariablesError(kind: string, messageTemplate: string): Result<never> | null {
  const unknown = findUnknownTemplateVariables(messageTemplate, RULE_EXTRA_TEMPLATE_VARS[kind] ?? []);
  if (unknown.length === 0) return null;
  const list = unknown.map((name) => `{{${name}}}`).join(", ");
  return fail(`Variável desconhecida no template: ${list}.`, { messageTemplate: [`Variável desconhecida: ${list}`] });
}

/** Criar regra automática (3.10, `/lembretes/regras`). */
export async function createReminderRule(input: z.input<typeof reminderRuleInputSchema>): Promise<Result<{ id: string }>> {
  const parsed = reminderRuleInputSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const variablesError = ruleUnknownVariablesError(parsed.data.kind, parsed.data.messageTemplate);
  if (variablesError) return variablesError;

  const { supabase, user } = await requireOwner();

  const { data, error } = await supabase
    .from("reminder_rules")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      kind: parsed.data.kind,
      channel: parsed.data.channel,
      recipient_type: parsed.data.recipientType,
      message_template: parsed.data.messageTemplate,
      enabled: parsed.data.enabled,
      config: parsed.data.config as unknown as Json,
    })
    .select("id")
    .single();

  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath(REMINDER_RULES_PATH);
  return ok({ id: data.id });
}

/** Editar regra automática (3.10) — não mexe nos lembretes já gerados por ela; o próximo ciclo do `generate_reminders` aplica as mudanças. */
export async function updateReminderRule(id: string, input: z.input<typeof reminderRuleInputSchema>): Promise<Result<null>> {
  const parsed = reminderRuleInputSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const variablesError = ruleUnknownVariablesError(parsed.data.kind, parsed.data.messageTemplate);
  if (variablesError) return variablesError;

  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("reminder_rules")
    .update({
      name: parsed.data.name,
      kind: parsed.data.kind,
      channel: parsed.data.channel,
      recipient_type: parsed.data.recipientType,
      message_template: parsed.data.messageTemplate,
      enabled: parsed.data.enabled,
      config: parsed.data.config as unknown as Json,
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) return fail(GENERIC_ERROR);

  revalidatePath(REMINDER_RULES_PATH);
  return ok(null);
}

export async function setReminderRuleEnabled(id: string, enabled: boolean): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("reminder_rules").update({ enabled }).eq("id", id).eq("owner_id", user.id);
  if (error) return fail("Não foi possível atualizar a regra. Tente de novo.");
  revalidatePath(REMINDER_RULES_PATH);
  return ok(null);
}

/** Apaga só a regra — lembretes já gerados por ela continuam existindo (com `rule_id` apontando pra um registro que não existe mais), o que é intencional: já foram criados, o dono decide se quer cancelar cada um manualmente. */
export async function deleteReminderRule(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("reminder_rules").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return fail("Não foi possível apagar a regra. Tente de novo.");
  revalidatePath(REMINDER_RULES_PATH);
  return ok(null);
}
