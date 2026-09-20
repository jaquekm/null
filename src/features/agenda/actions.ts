"use server";

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { requireOwner } from "@/lib/auth";
import { fail, type Result } from "@/lib/result";
import { createEvent } from "@/features/events/actions";
import type { AgendaEntry } from "./lib/agenda-entry";
import { buildGoogleEventEntries } from "./lib/build-google-event-entries";
import { buildReminderEntries } from "./lib/build-reminder-entries";
import { extractItemDateEntries } from "./lib/extract-item-date-entries";
import {
  getPrimaryCalendarId,
  getUserTimezone,
  listCalendarColors,
  listDateFieldsByTypeId,
  listGoogleEventsInRange,
  listItemsForDateExtraction,
  listRemindersInRange,
} from "./queries";

export interface AgendaSources {
  events: boolean;
  items: boolean;
  reminders: boolean;
}

/** Busca unificada pro `/agenda` (3.6) — chamada pelo cliente sempre que a visão/intervalo do calendário muda. */
export async function fetchAgendaEvents(startIso: string, endIso: string, sources: AgendaSources): Promise<AgendaEntry[]> {
  const { supabase, user } = await requireOwner();
  const entries: AgendaEntry[] = [];

  if (sources.events) {
    const [events, colors] = await Promise.all([
      listGoogleEventsInRange(supabase, user.id, startIso, endIso),
      listCalendarColors(supabase, user.id),
    ]);
    entries.push(...buildGoogleEventEntries(events, colors));
  }

  if (sources.items) {
    const dateFieldsByTypeId = await listDateFieldsByTypeId(supabase, user.id);
    const items = await listItemsForDateExtraction(supabase, user.id, [...dateFieldsByTypeId.keys()]);
    entries.push(...extractItemDateEntries(items, dateFieldsByTypeId, startIso, endIso));
  }

  if (sources.reminders) {
    const reminders = await listRemindersInRange(supabase, user.id, startIso, endIso);
    entries.push(...buildReminderEntries(reminders));
  }

  return entries;
}

/** Cria um bloco de tempo pra uma tarefa arrastada no planejador do dia (3.6) — liga o evento ao item (`events.item_id`). */
export async function createTimeBlockFromTask(itemId: string, itemTitle: string, startMinutesSinceMidnight: number): Promise<Result<{ id: string }>> {
  const { supabase, user } = await requireOwner();

  const calendarId = await getPrimaryCalendarId(supabase, user.id);
  if (!calendarId) return fail("Conecte o Google Calendar em /configuracoes/integracoes pra criar blocos de tempo.");

  const timezone = await getUserTimezone(supabase, user.id);
  const todayDateStr = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  const hours = String(Math.floor(startMinutesSinceMidnight / 60)).padStart(2, "0");
  const minutes = String(startMinutesSinceMidnight % 60).padStart(2, "0");
  const start = fromZonedTime(`${todayDateStr}T${hours}:${minutes}:00`, timezone);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  return createEvent({
    calendarId,
    title: itemTitle,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    allDay: false,
    itemId,
  });
}
