"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import {
  deleteGoogleEvent,
  GoogleEventConflictError,
  GoogleEventNotFoundError,
  insertGoogleEvent,
  patchGoogleEvent,
} from "@/lib/google/calendar";
import { getAccessToken } from "@/lib/google/client";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { mapGoogleEventToRow } from "./lib/map-google-event";
import { mapRowToGoogleEventInput, type EventRowForPush } from "./lib/map-row-to-google-event-input";
import { createEventSchema, updateEventSchema } from "./schemas";

const AGENDA_PATH = "/agenda";

function toAttendeesJson(emails: string[]): Json {
  return emails.map((email) => ({ email, name: null, response: null })) as unknown as Json;
}

/**
 * Cria um evento (3.5, escrita app → Google): grava local **primeiro**
 * (pra existir na hora, mesmo se o Google demorar ou a rede cair) e chama a
 * API imediatamente. Falha de rede: fica `local_dirty=true` e um
 * `calendar_push` reenvia depois — não é um erro pro usuário, o evento já
 * está salvo.
 */
export async function createEvent(input: unknown): Promise<Result<{ id: string }>> {
  const { supabase, user } = await requireOwner();
  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.", parsed.error.flatten().fieldErrors);
  const data = parsed.data;

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id, connection_id, external_id")
    .eq("id", data.calendarId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!calendar) return fail("Calendário não encontrado.");

  const { data: row, error: insertError } = await supabase
    .from("events")
    .insert({
      owner_id: user.id,
      calendar_id: calendar.id,
      external_id: null,
      title: data.title,
      description: data.description ?? null,
      location: data.location ?? null,
      starts_at: new Date(data.startsAt).toISOString(),
      ends_at: new Date(data.endsAt).toISOString(),
      all_day: data.allDay,
      timezone: data.timezone ?? null,
      status: "confirmed",
      attendees: toAttendeesJson(data.attendeeEmails),
      local_dirty: true,
    })
    .select(
      "id, title, description, location, starts_at, ends_at, all_day, timezone, attendees",
    )
    .single();
  if (insertError || !row) return fail("Não foi possível criar o evento.");

  try {
    const accessToken = await getAccessToken(supabase, calendar.connection_id);
    const googleEvent = await insertGoogleEvent(accessToken, calendar.external_id, {
      ...mapRowToGoogleEventInput(row as EventRowForPush),
      addMeet: data.addMeet,
    });
    const mapped = mapGoogleEventToRow(googleEvent);
    await supabase
      .from("events")
      .update({ ...mapped, attendees: mapped.attendees as unknown as Json, local_dirty: false })
      .eq("id", row.id);
  } catch {
    await enqueueJob({ ownerId: user.id, kind: "calendar_push", payload: { eventId: row.id, operation: "create" } });
  }

  revalidatePath(AGENDA_PATH);
  return ok({ id: row.id });
}

/**
 * Edita um evento (3.5). Se o `etag` remoto mudou (alguém editou pelo
 * Google enquanto isso), o Google vence — a edição local não é reenviada, e
 * a próxima sincronização periódica (`calendar_sync`) traz a versão de lá
 * por cima. O usuário é avisado pelo `Result` de erro.
 */
export async function updateEvent(input: unknown): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const parsed = updateEventSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.", parsed.error.flatten().fieldErrors);
  const data = parsed.data;

  const { data: event } = await supabase
    .from("events")
    .select("id, calendar_id, external_id, remote_etag, title, description, location, starts_at, ends_at, all_day, timezone, attendees")
    .eq("id", data.eventId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!event || !event.calendar_id) return fail("Evento não encontrado.");

  const { data: calendar } = await supabase
    .from("calendars")
    .select("connection_id, external_id")
    .eq("id", event.calendar_id)
    .maybeSingle();
  if (!calendar) return fail("Calendário do evento não encontrado.");

  const merged: EventRowForPush = {
    title: data.title ?? event.title,
    description: data.description ?? event.description,
    location: data.location ?? event.location,
    starts_at: data.startsAt ? new Date(data.startsAt).toISOString() : event.starts_at,
    ends_at: data.endsAt ? new Date(data.endsAt).toISOString() : event.ends_at,
    all_day: data.allDay ?? event.all_day,
    timezone: data.timezone ?? event.timezone,
    attendees: data.attendeeEmails ? toAttendeesJson(data.attendeeEmails) : event.attendees,
  };

  const { error: updateError } = await supabase
    .from("events")
    .update({ ...merged, attendees: merged.attendees as unknown as Json, local_dirty: true })
    .eq("id", event.id);
  if (updateError) return fail("Não foi possível salvar as alterações.");

  if (!event.external_id) {
    // Ainda nem existe no Google (criação original ainda pendente) — o
    // `calendar_push` de criação, quando rodar, já pega este texto mais novo.
    revalidatePath(AGENDA_PATH);
    return ok(null);
  }

  try {
    const accessToken = await getAccessToken(supabase, calendar.connection_id);
    const googleEvent = await patchGoogleEvent(
      accessToken,
      calendar.external_id,
      event.external_id,
      mapRowToGoogleEventInput(merged),
      event.remote_etag ?? undefined,
    );
    const mapped = mapGoogleEventToRow(googleEvent);
    await supabase
      .from("events")
      .update({ ...mapped, attendees: mapped.attendees as unknown as Json, local_dirty: false })
      .eq("id", event.id);
  } catch (err) {
    if (err instanceof GoogleEventConflictError) {
      await supabase.from("events").update({ local_dirty: false }).eq("id", event.id);
      return fail("O evento foi alterado no Google Calendar enquanto você editava. A versão de lá foi mantida.");
    }
    if (err instanceof GoogleEventNotFoundError) {
      await supabase.from("events").update({ status: "cancelled", local_dirty: false }).eq("id", event.id);
      return fail("Esse evento foi excluído no Google Calendar.");
    }
    await enqueueJob({ ownerId: user.id, kind: "calendar_push", payload: { eventId: event.id, operation: "update" } });
  }

  revalidatePath(AGENDA_PATH);
  return ok(null);
}

/** Exclui um evento (3.5). Falha de rede: marca `cancelled`+`local_dirty` e reenvia depois (`calendar_push`) — some da agenda na hora mesmo assim. */
export async function deleteEvent(eventId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { data: event } = await supabase
    .from("events")
    .select("id, calendar_id, external_id")
    .eq("id", eventId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!event) return fail("Evento não encontrado.");

  if (!event.external_id) {
    await supabase.from("events").delete().eq("id", event.id);
    revalidatePath(AGENDA_PATH);
    return ok(null);
  }

  if (!event.calendar_id) return fail("Evento sem calendário associado.");

  const { data: calendar } = await supabase
    .from("calendars")
    .select("connection_id, external_id")
    .eq("id", event.calendar_id)
    .maybeSingle();
  if (!calendar) return fail("Calendário do evento não encontrado.");

  try {
    const accessToken = await getAccessToken(supabase, calendar.connection_id);
    await deleteGoogleEvent(accessToken, calendar.external_id, event.external_id);
    await supabase.from("events").delete().eq("id", event.id);
  } catch (err) {
    if (err instanceof GoogleEventNotFoundError) {
      await supabase.from("events").delete().eq("id", event.id);
    } else {
      await supabase.from("events").update({ status: "cancelled", local_dirty: true }).eq("id", event.id);
      await enqueueJob({ ownerId: user.id, kind: "calendar_push", payload: { eventId: event.id, operation: "delete" } });
    }
  }

  revalidatePath(AGENDA_PATH);
  return ok(null);
}
