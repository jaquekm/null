"use server";

import type { JSONContent } from "@tiptap/core";
import { computeDayRange } from "@/features/agenda/lib/day-range";
import { fetchAgendaEvents } from "@/features/agenda/actions";
import { getUserTimezone } from "@/features/agenda/queries";
import { extractText } from "@/features/items/lib/extract-text";
import { getObjectTypeBySlug } from "@/features/types/queries";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";

function heading(level: number, text: string): JSONContent {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

function taskList(items: string[]): JSONContent {
  return { type: "taskList", content: items.map((text) => ({ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text }] }] })) };
}

function emptyParagraph(): JSONContent {
  return { type: "paragraph", content: [] };
}

function buildDailyNoteTemplate(agendaTitles: string[]): JSONContent {
  return {
    type: "doc",
    content: [
      heading(3, "Prioridades"),
      taskList(["", "", ""]),
      heading(3, "Agenda de hoje"),
      agendaTitles.length > 0 ? taskList(agendaTitles) : emptyParagraph(),
      heading(3, "Notas"),
      emptyParagraph(),
    ],
  };
}

/**
 * Nota diária (5.8, opcional): abre (ou cria, na primeira vez do dia) o item
 * "Nota diária — AAAA-MM-DD" com um template (prioridades, agenda do dia,
 * notas) — acionada pelo atalho `Ctrl/Cmd+D` de qualquer página.
 */
export async function getOrCreateDailyNote(): Promise<Result<{ id: string }>> {
  const { supabase, user } = await requireOwner();

  const notaType = await getObjectTypeBySlug(supabase, "nota");
  if (!notaType) return fail('Tipo de sistema "Nota" não encontrado.');

  const timezone = await getUserTimezone(supabase, user.id);
  const today = computeDayRange(new Date(), timezone);
  const title = `Nota diária — ${today.dateStr}`;

  const { data: existing } = await supabase
    .from("items")
    .select("id")
    .eq("owner_id", user.id)
    .eq("type_id", notaType.id)
    .eq("title", title)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return ok({ id: existing.id });

  const agenda = await fetchAgendaEvents(today.startIso, today.endIsoExclusive, { events: true, items: true, reminders: true });
  const content = buildDailyNoteTemplate(agenda.map((entry) => entry.title));

  const { data: created, error } = await supabase
    .from("items")
    .insert({
      owner_id: user.id,
      title,
      type_id: notaType.id,
      status: "active",
      content: content as unknown as Json,
      content_text: extractText(content),
    })
    .select("id")
    .single();

  if (error || !created) return fail("Não foi possível criar a nota diária.");
  return ok({ id: created.id });
}
