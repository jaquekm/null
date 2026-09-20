import type { SupabaseClient } from "@supabase/supabase-js";
import { mapGoogleEventToRow } from "@/features/events/lib/map-google-event";
import { matchAttendeesToContactIds } from "@/features/events/lib/match-attendees-to-contacts";
import {
  type GoogleCalendarEvent,
  GoogleSyncTokenExpiredError,
  listCalendarEvents,
} from "@/lib/google/calendar";
import { GoogleConnectionNotFoundError, GoogleConnectionRevokedError, getAccessToken } from "@/lib/google/client";
import type { Database, Json } from "@/lib/supabase/database.types";
import { enqueueJob } from "../enqueue";
import type { JobHandler } from "../types";

type Client = SupabaseClient<Database>;

/** Sincronização completa (sem `syncToken`) só pega daqui pra frente — não importa o histórico inteiro da conta Google. */
const FULL_SYNC_LOOKBACK_DAYS = 90;
/** Eventos cancelados ficam guardados por 30 dias (enunciado da 3.5) — dá pra ver "isso foi cancelado" antes de sumir. */
const CANCELLED_RETENTION_DAYS = 30;

async function fetchAllEvents(
  accessToken: string,
  externalCalendarId: string,
  syncToken: string | null,
): Promise<{ events: GoogleCalendarEvent[]; nextSyncToken: string | null }> {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | null = null;
  let nextSyncToken: string | null = null;
  let effectiveSyncToken = syncToken;
  // Fixo por chamada: se mudasse a cada página, violaria a exigência do Google de
  // que os parâmetros da sincronização completa sejam os mesmos em todas as páginas.
  const fullSyncTimeMin = new Date(Date.now() - FULL_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  for (;;) {
    let page;
    try {
      page = await listCalendarEvents(accessToken, externalCalendarId, {
        syncToken: effectiveSyncToken ?? undefined,
        pageToken: pageToken ?? undefined,
        timeMin: effectiveSyncToken ? undefined : fullSyncTimeMin,
      });
    } catch (err) {
      if (err instanceof GoogleSyncTokenExpiredError && effectiveSyncToken) {
        // `syncToken` expirado (410): descarta e refaz do zero, como sincronização completa.
        effectiveSyncToken = null;
        pageToken = null;
        events.length = 0;
        continue;
      }
      throw err;
    }

    events.push(...page.events);
    if (page.nextSyncToken) nextSyncToken = page.nextSyncToken;
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }

  return { events, nextSyncToken };
}

/** Preenche `item_contacts` pra eventos que já viraram nota de reunião (`item_id`) — casando `attendees` por e-mail. */
async function linkAttendeesToContacts(
  supabase: Client,
  ownerId: string,
  events: { item_id: string | null; attendees: unknown }[],
): Promise<void> {
  const { data: contacts } = await supabase.from("contacts").select("id, email").eq("owner_id", ownerId);
  if (!contacts || contacts.length === 0) return;

  const rows: { item_id: string; contact_id: string; owner_id: string; role: string }[] = [];
  for (const event of events) {
    if (!event.item_id) continue;
    const attendees = Array.isArray(event.attendees) ? (event.attendees as { email: string }[]) : [];
    const contactIds = matchAttendeesToContactIds(attendees, contacts);
    for (const contactId of contactIds) {
      rows.push({ item_id: event.item_id, contact_id: contactId, owner_id: ownerId, role: "participant" });
    }
  }
  if (rows.length === 0) return;

  await supabase.from("item_contacts").upsert(rows, { onConflict: "item_id,contact_id", ignoreDuplicates: true });
}

/**
 * Job `calendar_sync` (3.5, periódico a cada 10 min via `job_schedules` +
 * botão "Sincronizar agora"): puxa eventos de todo calendário com
 * `sync_enabled` do dono. Sincronização incremental (`syncToken`) quando já
 * tem um salvo, completa (últimos `FULL_SYNC_LOOKBACK_DAYS` dias) senão —
 * `singleEvents=true` nos dois casos, decisão em `docs/decisoes.md`.
 */
export const calendarSync: JobHandler = async (job, { supabase }) => {
  const { data: calendars, error } = await supabase
    .from("calendars")
    .select("id, connection_id, external_id, sync_token")
    .eq("owner_id", job.owner_id)
    .eq("sync_enabled", true);
  if (error) return { status: "retry", error: error.message };
  if (!calendars || calendars.length === 0) return { status: "done", result: { calendarsSynced: 0 } };

  const { data: connections, error: connectionsError } = await supabase
    .from("google_connections")
    .select("id, status")
    .eq("owner_id", job.owner_id);
  if (connectionsError) return { status: "retry", error: connectionsError.message };
  const connectionStatusById = new Map((connections ?? []).map((connection) => [connection.id, connection.status]));

  const errors: string[] = [];
  let calendarsSynced = 0;
  let eventsUpserted = 0;

  for (const calendar of calendars) {
    if (connectionStatusById.get(calendar.connection_id) !== "active") continue; // revogada — espera o dono reconectar (3.4)

    let accessToken: string;
    try {
      accessToken = await getAccessToken(supabase, calendar.connection_id);
    } catch (err) {
      if (err instanceof GoogleConnectionRevokedError || err instanceof GoogleConnectionNotFoundError) continue;
      errors.push(err instanceof Error ? err.message : "Falha ao obter o access token.");
      continue;
    }

    let events: GoogleCalendarEvent[];
    let nextSyncToken: string | null;
    try {
      const result = await fetchAllEvents(accessToken, calendar.external_id, calendar.sync_token);
      events = result.events;
      nextSyncToken = result.nextSyncToken;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Falha ao listar eventos do calendário.");
      continue;
    }

    if (events.length > 0) {
      const rows = events.map((event) => {
        const mapped = mapGoogleEventToRow(event);
        return { owner_id: job.owner_id, calendar_id: calendar.id, ...mapped, attendees: mapped.attendees as unknown as Json };
      });

      const { data: written, error: upsertError } = await supabase
        .from("events")
        .upsert(rows, { onConflict: "calendar_id,external_id" })
        .select("item_id, attendees");
      if (upsertError) {
        errors.push(upsertError.message);
        continue;
      }
      eventsUpserted += written?.length ?? 0;

      const withMeetingNote = (written ?? []).filter((row) => row.item_id);
      if (withMeetingNote.length > 0) {
        await linkAttendeesToContacts(supabase, job.owner_id, withMeetingNote);
      }
    }

    const cutoff = new Date(Date.now() - CANCELLED_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("events").delete().eq("calendar_id", calendar.id).eq("status", "cancelled").lt("updated_at", cutoff);

    await supabase
      .from("calendars")
      .update({ sync_token: nextSyncToken, last_synced_at: new Date().toISOString() })
      .eq("id", calendar.id);

    calendarsSynced += 1;
  }

  if (errors.length > 0) return { status: "retry", error: errors.join("; ") };

  // "generate_reminders roda a cada 15 min e depois do calendar_sync" (3.10) — eventos novos/
  // remarcados só entram nas regras de lembrete de reunião depois desse job rodar de novo.
  if (calendarsSynced > 0) {
    await enqueueJob({ ownerId: job.owner_id, kind: "generate_reminders", dedupeKey: `generate_reminders:after_calendar_sync:${job.owner_id}` });
  }

  return { status: "done", result: { calendarsSynced, eventsUpserted } };
};
