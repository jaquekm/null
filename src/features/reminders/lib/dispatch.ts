import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import { getMessageChannel, type MessageChannelKind } from "@/lib/messaging/types";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { decideDelivery } from "./delivery-rules";
import { nextOccurrence } from "./recurrence";
import { applyQuietHours } from "./quiet-hours";
import { buildTemplateVars, renderTemplate } from "./render-template";

type Client = SupabaseClient<Database>;
type ReminderRow = Tables<"reminders">;

const SENT_STATUSES = ["sent", "delivered", "read"];
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

interface RecipientContact {
  id: string;
  name: string;
  nickname: string | null;
  phone_e164: string | null;
  email: string | null;
  preferred_channel: string;
  whatsapp_opt_in: boolean;
  email_opt_in: boolean;
  opted_out_at: string | null;
}

interface Recipient {
  contactId: string | null;
  contact: RecipientContact | null;
}

function resolveChannel(reminder: ReminderRow, isThirdParty: boolean, contact: RecipientContact | null): string {
  if (reminder.channel !== "auto") return reminder.channel;
  if (isThirdParty) return contact?.preferred_channel ?? "whatsapp";
  return "push"; // "auto" pra "eu" usa push (3.9) — o dono não tem `preferred_channel` como os contatos.
}

function resolveDestination(channel: string, isThirdParty: boolean, contact: RecipientContact | null, ownerId: string): string | null {
  if (channel === "whatsapp") return isThirdParty ? (contact?.phone_e164 ?? null) : null;
  if (channel === "email") return isThirdParty ? (contact?.email ?? null) : serverEnv.OWNER_EMAIL;
  if (channel === "push") return isThirdParty ? null : ownerId; // push é só pro dono (3.9)
  return null;
}

function resolveChannelOptIn(channel: string, isThirdParty: boolean, contact: RecipientContact | null): boolean {
  if (!isThirdParty) return true;
  if (channel === "whatsapp") return contact?.whatsapp_opt_in ?? false;
  if (channel === "email") return contact?.email_opt_in ?? false;
  return true;
}

async function countDeliveriesLast24h(supabase: Client, ownerId: string, contactId: string, before: Date): Promise<number> {
  const since = new Date(before.getTime() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from("reminder_deliveries")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("contact_id", contactId)
    .gte("created_at", since)
    .in("status", SENT_STATUSES);
  return data?.length ?? 0;
}

export interface DispatchOccurrenceOptions {
  /** "Enviar agora" (manual): ignora o horário silencioso, mas mantém opt-out/destino/limite diário. */
  bypassQuietHours?: boolean;
}

export interface DispatchOccurrenceResult {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Processa uma ocorrência de um lembrete: pra cada destinatário (dono ou
 * contatos), decide se envia (`decideDelivery`), registra `reminder_deliveries`
 * (o índice único evita duplicidade se chamado de novo pra mesma ocorrência) e
 * envia pelo canal (3.9 — ainda stub, então toda entrega permitida vira `failed`
 * com "canal não configurado" até lá). No fim, calcula a próxima ocorrência
 * (`reminders.rrule`) ou marca `completed`. Usada pelo job `dispatch_reminders`
 * (periódico) e pelo botão "Enviar agora" (3.8) — mesmo núcleo, como
 * `createMeetingNoteForEvent` (3.7) é usado pelo botão manual e pelo job.
 */
export async function dispatchReminderOccurrence(
  supabase: Client,
  ownerId: string,
  reminder: ReminderRow,
  options: DispatchOccurrenceOptions = {},
): Promise<DispatchOccurrenceResult> {
  const occurrenceAt = new Date(reminder.send_at);
  const isThirdParty = reminder.recipient_type === "contacts";

  let recipients: Recipient[];
  if (isThirdParty) {
    if (reminder.contact_ids.length === 0) {
      recipients = [];
    } else {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, nickname, phone_e164, email, preferred_channel, whatsapp_opt_in, email_opt_in, opted_out_at")
        .eq("owner_id", ownerId)
        .in("id", reminder.contact_ids);
      const contactsById = new Map((contacts ?? []).map((c) => [c.id, c as RecipientContact]));
      recipients = reminder.contact_ids.map((id) => ({ contactId: id, contact: contactsById.get(id) ?? null }));
    }
  } else {
    recipients = [{ contactId: null, contact: null }];
  }

  const result: DispatchOccurrenceResult = { sent: 0, failed: 0, skipped: 0 };
  const extraVariables = Object.fromEntries(
    Object.entries((reminder.variables ?? {}) as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
  );

  for (const recipient of recipients) {
    const channel = resolveChannel(reminder, isThirdParty, recipient.contact);
    const destination = resolveDestination(channel, isThirdParty, recipient.contact, ownerId);
    const channelOptIn = resolveChannelOptIn(channel, isThirdParty, recipient.contact);
    const deliveriesLast24h =
      isThirdParty && recipient.contactId ? await countDeliveriesLast24h(supabase, ownerId, recipient.contactId, occurrenceAt) : 0;

    const decision = decideDelivery({
      isThirdParty,
      optedOutAt: recipient.contact?.opted_out_at ?? null,
      channelOptIn,
      destination,
      occurrenceAt,
      timezone: reminder.timezone,
      deliveriesLast24h,
      bypassQuietHours: options.bypassQuietHours,
    });

    const renderedMessage = renderTemplate(
      reminder.message_template,
      buildTemplateVars({
        title: reminder.title,
        occurrenceAt,
        timezone: reminder.timezone,
        recipient: recipient.contact ? { nickname: recipient.contact.nickname, name: recipient.contact.name } : null,
        extra: extraVariables,
      }),
    );

    const { data: delivery, error: insertError } = await supabase
      .from("reminder_deliveries")
      .insert({
        owner_id: ownerId,
        reminder_id: reminder.id,
        contact_id: recipient.contactId,
        occurrence_at: occurrenceAt.toISOString(),
        channel,
        destination,
        rendered_message: renderedMessage,
        status: decision.allowed ? "pending" : "skipped",
        skip_reason: decision.allowed ? null : decision.reason,
      })
      .select("id")
      .single();

    if (insertError || !delivery) {
      // Índice único violado (23505) = essa ocorrência já foi processada pra esse destinatário
      // (ex.: o job rodou de novo antes de avançar `send_at`) — não conta como falha, só pula.
      continue;
    }

    if (!decision.allowed) {
      result.skipped += 1;
      continue;
    }

    const provider = getMessageChannel(channel as MessageChannelKind);
    if (!provider) {
      await supabase.from("reminder_deliveries").update({ status: "failed", error: "Canal não configurado." }).eq("id", delivery.id);
      result.failed += 1;
      continue;
    }

    try {
      const sendResult = await provider.send({ deliveryId: delivery.id, to: destination!, text: renderedMessage });
      await supabase
        .from("reminder_deliveries")
        .update({ status: "sent", provider_message_id: sendResult.providerMessageId ?? null })
        .eq("id", delivery.id);
      result.sent += 1;
    } catch (err) {
      await supabase
        .from("reminder_deliveries")
        .update({ status: "failed", error: err instanceof Error ? err.message : "Falha ao enviar." })
        .eq("id", delivery.id);
      result.failed += 1;
    }
  }

  let next = reminder.rrule ? nextOccurrence(reminder.rrule, reminder.timezone, occurrenceAt) : null;
  if (next && isThirdParty) next = applyQuietHours(next, reminder.timezone);
  if (next && reminder.ends_at && next > new Date(reminder.ends_at)) next = null;

  const now = new Date().toISOString();
  if (next) {
    await supabase.from("reminders").update({ send_at: next.toISOString(), last_sent_at: now }).eq("id", reminder.id);
  } else {
    await supabase.from("reminders").update({ status: "completed", last_sent_at: now }).eq("id", reminder.id);
  }

  return result;
}
