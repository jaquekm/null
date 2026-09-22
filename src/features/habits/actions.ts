"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { toggleHabitDay } from "./lib/habit-log";

/** Alterna o registro de um dia de um item Hábito (5.12) — grava direto em `properties.log`, fora do editor genérico de campos. */
export async function toggleHabitLog(itemId: string, dateStr: string): Promise<Result<{ logged: boolean }>> {
  const { supabase, user } = await requireOwner();

  const { data: item, error: readError } = await supabase.from("items").select("properties").eq("id", itemId).eq("owner_id", user.id).maybeSingle();
  if (readError || !item) return fail("Item não encontrado.");

  const properties = (item.properties as Record<string, unknown> | null) ?? {};
  const nextLog = toggleHabitDay(properties.log as Record<string, boolean> | undefined, dateStr);

  const { error } = await supabase
    .from("items")
    .update({ properties: { ...properties, log: nextLog } as unknown as Json })
    .eq("id", itemId)
    .eq("owner_id", user.id);
  if (error) return fail("Não foi possível salvar o registro do hábito.");

  revalidatePath(`/itens/${itemId}`);
  return ok({ logged: Boolean(nextLog[dateStr]) });
}
