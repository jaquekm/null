"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import type { Result } from "@/lib/result";
import { createMeetingNoteForEvent, type MeetingNoteResult } from "./lib/create-meeting-note";

/** Botão "Criar nota da reunião" / "Abrir nota" (3.7). */
export async function createMeetingNote(eventId: string): Promise<Result<MeetingNoteResult>> {
  const { supabase, user } = await requireOwner();
  const result = await createMeetingNoteForEvent(supabase, user.id, eventId);
  if (result.ok && !result.data.alreadyExisted) {
    revalidatePath("/agenda");
    revalidatePath("/agenda/hoje");
  }
  return result;
}
