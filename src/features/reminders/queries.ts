import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export async function getUserTimezone(supabase: Client, ownerId: string): Promise<string> {
  const { data } = await supabase.from("user_settings").select("timezone").eq("owner_id", ownerId).maybeSingle();
  return data?.timezone ?? DEFAULT_TIMEZONE;
}

export interface ReminderListRow {
  id: string;
  title: string;
  messageTemplate: string;
  channel: string;
  recipientType: string;
  contactIds: string[];
  sendAt: string;
  rrule: string | null;
  timezone: string;
  endsAt: string | null;
  status: string;
  itemId: string | null;
  lastSentAt: string | null;
}

const REMINDER_COLUMNS =
  "id, title, message_template, channel, recipient_type, contact_ids, send_at, rrule, timezone, ends_at, status, item_id, last_sent_at";

function mapReminderRow(row: Record<string, unknown>): ReminderListRow {
  return {
    id: row.id as string,
    title: row.title as string,
    messageTemplate: row.message_template as string,
    channel: row.channel as string,
    recipientType: row.recipient_type as string,
    contactIds: (row.contact_ids as string[]) ?? [],
    sendAt: row.send_at as string,
    rrule: row.rrule as string | null,
    timezone: row.timezone as string,
    endsAt: row.ends_at as string | null,
    status: row.status as string,
    itemId: row.item_id as string | null,
    lastSentAt: row.last_sent_at as string | null,
  };
}

/** Aba "Próximos" (3.8): lembretes agendados, mais próximo primeiro. */
export async function listUpcomingReminders(supabase: Client): Promise<ReminderListRow[]> {
  const { data } = await supabase.from("reminders").select(REMINDER_COLUMNS).eq("status", "scheduled").order("send_at", { ascending: true });
  return (data ?? []).map(mapReminderRow);
}

/** Aba "Recorrentes" (3.8): lembretes com `rrule`, agendados ou pausados. */
export async function listRecurringReminders(supabase: Client): Promise<ReminderListRow[]> {
  const { data } = await supabase
    .from("reminders")
    .select(REMINDER_COLUMNS)
    .not("rrule", "is", null)
    .in("status", ["scheduled", "paused"])
    .order("send_at", { ascending: true });
  return (data ?? []).map(mapReminderRow);
}

export async function getReminderById(supabase: Client, id: string): Promise<ReminderListRow | null> {
  const { data } = await supabase.from("reminders").select(REMINDER_COLUMNS).eq("id", id).maybeSingle();
  return data ? mapReminderRow(data) : null;
}

export interface DeliveryListRow {
  id: string;
  reminderId: string;
  reminderTitle: string;
  contactName: string | null;
  channel: string;
  destination: string | null;
  status: string;
  skipReason: string | null;
  error: string | null;
  occurrenceAt: string;
  providerMessageId: string | null;
}

interface DeliveryJoinedRow {
  id: string;
  reminder_id: string;
  channel: string;
  destination: string | null;
  status: string;
  skip_reason: string | null;
  error: string | null;
  occurrence_at: string;
  provider_message_id: string | null;
  reminders: { title: string } | null;
  contacts: { name: string } | null;
}

function mapDeliveryRow(row: DeliveryJoinedRow): DeliveryListRow {
  return {
    id: row.id,
    reminderId: row.reminder_id,
    reminderTitle: row.reminders?.title ?? "(lembrete removido)",
    contactName: row.contacts?.name ?? null,
    channel: row.channel,
    destination: row.destination,
    status: row.status,
    skipReason: row.skip_reason,
    error: row.error,
    occurrenceAt: row.occurrence_at,
    providerMessageId: row.provider_message_id,
  };
}

const DELIVERY_COLUMNS =
  "id, reminder_id, channel, destination, status, skip_reason, error, occurrence_at, provider_message_id, reminders(title), contacts(name)";

/** Aba "Enviados" (3.8): entregas com sucesso, mais recente primeiro. */
export async function listSentDeliveries(supabase: Client): Promise<DeliveryListRow[]> {
  const { data } = await supabase
    .from("reminder_deliveries")
    .select(DELIVERY_COLUMNS)
    .in("status", ["sent", "delivered", "read"])
    .order("occurrence_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as unknown as DeliveryJoinedRow[]).map(mapDeliveryRow);
}

/** Aba "Com falha" (3.8): entregas que falharam de verdade (não as puladas por opt-out/horário/limite). */
export async function listFailedDeliveries(supabase: Client): Promise<DeliveryListRow[]> {
  const { data } = await supabase
    .from("reminder_deliveries")
    .select(DELIVERY_COLUMNS)
    .eq("status", "failed")
    .order("occurrence_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as unknown as DeliveryJoinedRow[]).map(mapDeliveryRow);
}
