import { createMeetingNoteForEvent } from "@/features/meeting-notes/lib/create-meeting-note";
import { getMeetingNotesSettings } from "@/features/settings/queries";
import type { JobHandler } from "../types";

/**
 * Job `prepare_meeting_notes` (3.7, periódico): pra quem ligou "criar notas de
 * reunião automaticamente", cria a nota dos eventos com convidados que
 * começam dentro da janela configurada (`X minutos antes`) e ainda não têm
 * `item_id`. Reaproveita o mesmo núcleo do botão manual (`createMeetingNoteForEvent`).
 */
export const prepareMeetingNotes: JobHandler = async (job, { supabase }) => {
  const settings = await getMeetingNotesSettings(supabase, job.owner_id);
  if (!settings.enabled) return { status: "done" };

  const now = new Date();
  const windowEnd = new Date(now.getTime() + settings.minutesBefore * 60 * 1000);

  const { data: events, error } = await supabase
    .from("events")
    .select("id, attendees")
    .eq("owner_id", job.owner_id)
    .is("item_id", null)
    .neq("status", "cancelled")
    .gte("starts_at", now.toISOString())
    .lte("starts_at", windowEnd.toISOString());
  if (error) return { status: "retry", error: error.message };
  if (!events || events.length === 0) return { status: "done", result: { created: 0 } };

  let created = 0;
  const errors: string[] = [];
  for (const event of events) {
    const attendees = Array.isArray(event.attendees) ? event.attendees : [];
    if (attendees.length === 0) continue; // "eventos com convidados" (enunciado)

    const result = await createMeetingNoteForEvent(supabase, job.owner_id, event.id);
    if (result.ok) created += 1;
    else errors.push(result.error);
  }

  if (errors.length > 0) return { status: "retry", error: errors.join("; ") };
  return { status: "done", result: { created } };
};
