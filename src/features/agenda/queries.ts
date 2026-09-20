import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { DateFieldDef, ItemForDateExtraction } from "./lib/extract-item-date-entries";
import type { GoogleEventRowForAgenda } from "./lib/build-google-event-entries";
import type { ReminderRowForAgenda } from "./lib/build-reminder-entries";

type Client = SupabaseClient<Database>;

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DATE_FIELD_TYPES = new Set(["date", "datetime"]);

export async function getUserTimezone(supabase: Client, ownerId: string): Promise<string> {
  const { data } = await supabase.from("user_settings").select("timezone").eq("owner_id", ownerId).maybeSingle();
  return data?.timezone ?? DEFAULT_TIMEZONE;
}

interface FieldDefinitionLike {
  key?: unknown;
  label?: unknown;
  type?: unknown;
}

/** Campos `date`/`datetime` de cada tipo de objeto do dono (3.6) — usado pra saber quais itens têm prazo. */
export async function listDateFieldsByTypeId(supabase: Client, ownerId: string): Promise<Map<string, DateFieldDef[]>> {
  const { data, error } = await supabase.from("object_types").select("id, fields").eq("owner_id", ownerId).is("archived_at", null);
  if (error || !data) return new Map();

  const result = new Map<string, DateFieldDef[]>();
  for (const type of data) {
    const fields = Array.isArray(type.fields) ? (type.fields as FieldDefinitionLike[]) : [];
    const dateFields = fields
      .filter((field): field is Required<FieldDefinitionLike> => typeof field.type === "string" && DATE_FIELD_TYPES.has(field.type))
      .map((field) => ({ key: String(field.key), label: String(field.label), type: field.type as "date" | "datetime" }));
    if (dateFields.length > 0) result.set(type.id, dateFields);
  }
  return result;
}

/** Itens (não excluídos) dos tipos que têm ao menos um campo de data — pra `extractItemDateEntries` filtrar por valor depois. */
export async function listItemsForDateExtraction(supabase: Client, ownerId: string, typeIds: string[]): Promise<ItemForDateExtraction[]> {
  if (typeIds.length === 0) return [];
  const { data, error } = await supabase
    .from("items")
    .select("id, title, type_id, properties")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .in("type_id", typeIds);
  if (error || !data) return [];
  return data.map((item) => ({
    id: item.id,
    title: item.title,
    type_id: item.type_id,
    properties: (item.properties as Record<string, unknown> | null) ?? {},
  }));
}

/** Eventos do Google que tocam o intervalo `[startIso, endIso)` (3.6) — sobreposição, não só o início dentro do intervalo. */
export async function listGoogleEventsInRange(
  supabase: Client,
  ownerId: string,
  startIso: string,
  endIso: string,
): Promise<GoogleEventRowForAgenda[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, starts_at, ends_at, all_day, status, calendar_id")
    .eq("owner_id", ownerId)
    .lt("starts_at", endIso)
    .gt("ends_at", startIso);
  if (error || !data) return [];
  return data;
}

/** `id → color` de todo calendário do dono (3.6) — pra colorir cada evento pela cor do calendário de origem. */
export async function listCalendarColors(supabase: Client, ownerId: string): Promise<Map<string, string | null>> {
  const { data, error } = await supabase.from("calendars").select("id, color").eq("owner_id", ownerId);
  if (error || !data) return new Map();
  return new Map(data.map((calendar) => [calendar.id, calendar.color]));
}

/** Lembretes agendados que caem no intervalo (3.6) — usa o índice parcial `(status, send_at)` da 3.1. */
export async function listRemindersInRange(supabase: Client, ownerId: string, startIso: string, endIso: string): Promise<ReminderRowForAgenda[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, send_at")
    .eq("owner_id", ownerId)
    .eq("status", "scheduled")
    .gte("send_at", startIso)
    .lt("send_at", endIso);
  if (error || !data) return [];
  return data;
}

export interface CalendarOption {
  id: string;
  name: string;
  color: string | null;
  isPrimary: boolean;
}

/** Calendários de conexões ativas (3.6) — pra o seletor "Calendário" do diálogo de criar evento. */
export async function listCalendarsForPicker(supabase: Client, ownerId: string): Promise<CalendarOption[]> {
  const { data: connections } = await supabase.from("google_connections").select("id").eq("owner_id", ownerId).eq("status", "active");
  const activeConnectionIds = (connections ?? []).map((connection) => connection.id);
  if (activeConnectionIds.length === 0) return [];

  const { data: calendars, error } = await supabase
    .from("calendars")
    .select("id, name, color, is_primary, connection_id")
    .eq("owner_id", ownerId)
    .in("connection_id", activeConnectionIds)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });
  if (error || !calendars) return [];
  return calendars.map((calendar) => ({ id: calendar.id, name: calendar.name, color: calendar.color, isPrimary: calendar.is_primary }));
}

/** Calendário principal sincronizado (3.6) — onde o planejador do dia cria o bloco de tempo de uma tarefa arrastada. */
export async function getPrimaryCalendarId(supabase: Client, ownerId: string): Promise<string | null> {
  const calendars = await listCalendarsForPicker(supabase, ownerId);
  return calendars.find((calendar) => calendar.isPrimary)?.id ?? calendars[0]?.id ?? null;
}
