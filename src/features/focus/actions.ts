"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import { logFocusSessionSchema } from "./schemas";

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";

/** "Parar e registrar" do cronômetro de foco (10.3) — sempre ligado a um item (tarefa ou projeto), já que o cronômetro só aparece na página de um deles. */
export async function logFocusSession(input: z.input<typeof logFocusSessionSchema>): Promise<Result<null>> {
  const parsed = logFocusSessionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const { error } = await supabase.from("focus_sessions").insert({
    owner_id: user.id,
    item_id: parsed.data.itemId,
    mode: parsed.data.mode,
    started_at: parsed.data.startedAt,
    ended_at: parsed.data.endedAt,
    duration_minutes: parsed.data.durationMinutes,
  });
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(`/itens/${parsed.data.itemId}`);
  revalidatePath("/rotina");
  return ok(null);
}
