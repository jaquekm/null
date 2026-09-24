import { z } from "zod";
import { mapGoogleEventToRow } from "@/features/events/lib/map-google-event";
import { mapRowToGoogleEventInput } from "@/features/events/lib/map-row-to-google-event-input";
import {
  deleteGoogleEvent,
  GoogleEventConflictError,
  GoogleEventNotFoundError,
  insertGoogleEvent,
  patchGoogleEvent,
} from "@/lib/google/calendar";
import { GoogleConnectionNotFoundError, GoogleConnectionRevokedError, getAccessToken } from "@/lib/google/client";
import type { Json } from "@/lib/supabase/database.types";
import type { JobHandler } from "../types";

const payloadSchema = z.object({
  eventId: z.string().uuid(),
  operation: z.enum(["create", "update", "delete"]),
});

/**
 * Job `calendar_push` (3.5): reenvia pro Google uma mudança feita no app que
 * falhou na hora (rede fora) — `local_dirty=true` até aqui. Sempre reconstrói
 * a entrada a partir do estado **atual** da linha (`mapRowToGoogleEventInput`),
 * não de uma cópia velha do momento da falha, então uma edição feita antes do
 * retry já sai com o texto mais novo.
 */
export const calendarPush: JobHandler = async (job, { supabase }) => {
  const parsed = payloadSchema.safeParse(job.payload);
  if (!parsed.success) return { status: "failed", error: "Payload inválido — falta eventId/operation." };
  const { eventId, operation } = parsed.data;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, calendar_id, external_id, remote_etag, title, description, location, starts_at, ends_at, all_day, timezone, attendees")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) return { status: "retry", error: eventError.message };
  if (!event) return { status: "done" }; // já foi apagado localmente — nada a empurrar
  if (!event.calendar_id) return { status: "failed", error: "Evento sem calendário associado." };

  const { data: calendar, error: calendarError } = await supabase
    .from("calendars")
    .select("connection_id, external_id")
    .eq("id", event.calendar_id)
    .maybeSingle();
  if (calendarError) return { status: "retry", error: calendarError.message };
  if (!calendar || !calendar.connection_id) return { status: "failed", error: "Calendário do evento não encontrado." };

  let accessToken: string;
  try {
    accessToken = await getAccessToken(supabase, calendar.connection_id);
  } catch (err) {
    if (err instanceof GoogleConnectionRevokedError || err instanceof GoogleConnectionNotFoundError) {
      return { status: "failed", error: "Conexão com o Google revogada — reconecte em /configuracoes/integracoes." };
    }
    return { status: "retry", error: err instanceof Error ? err.message : "Falha ao obter o access token." };
  }

  if (operation === "delete") {
    if (!event.external_id) return { status: "done" }; // nunca chegou a existir no Google
    try {
      await deleteGoogleEvent(accessToken, calendar.external_id, event.external_id);
    } catch (err) {
      if (!(err instanceof GoogleEventNotFoundError)) {
        return { status: "retry", error: err instanceof Error ? err.message : "Falha ao excluir o evento no Google." };
      }
    }
    await supabase.from("events").delete().eq("id", eventId);
    return { status: "done" };
  }

  const input = mapRowToGoogleEventInput(event);

  try {
    const googleEvent =
      operation === "create" || !event.external_id
        ? await insertGoogleEvent(accessToken, calendar.external_id, input)
        : await patchGoogleEvent(accessToken, calendar.external_id, event.external_id, input, event.remote_etag ?? undefined);

    const mapped = mapGoogleEventToRow(googleEvent);
    await supabase
      .from("events")
      .update({ ...mapped, attendees: mapped.attendees as unknown as Json, local_dirty: false })
      .eq("id", eventId);
    return { status: "done" };
  } catch (err) {
    if (err instanceof GoogleEventConflictError) {
      // O Google venceu o conflito — não insiste com os dados locais. A
      // próxima sincronização periódica (`calendar_sync`) traz a versão de
      // verdade do Google por cima desta linha.
      await supabase.from("events").update({ local_dirty: false }).eq("id", eventId);
      return { status: "done" };
    }
    if (err instanceof GoogleEventNotFoundError) {
      await supabase.from("events").update({ status: "cancelled", local_dirty: false }).eq("id", eventId);
      return { status: "done" };
    }
    return { status: "retry", error: err instanceof Error ? err.message : "Falha ao enviar o evento pro Google." };
  }
};
