"use server";

import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import { dispatchReminderOccurrence } from "./lib/dispatch";
import { buildRRuleString } from "./lib/recurrence";
import { findUnknownTemplateVariables } from "./lib/render-template";
import { reminderInputSchema } from "./schemas";

const GENERIC_ERROR = "Não foi possível salvar o lembrete. Tente de novo.";
const REMINDERS_PATH = "/lembretes";

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
