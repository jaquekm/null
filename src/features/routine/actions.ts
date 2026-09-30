"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { MAX_ROUTINE_BLOCKS, parseRoutineBlocks, removeBlock, routineBlockFields, routineBlockSchema, upsertBlock, type RoutineBlock } from "./lib/routine-blocks";

type Client = Awaited<ReturnType<typeof requireOwner>>["supabase"];

async function readPreferences(supabase: Client, ownerId: string): Promise<Record<string, unknown>> {
  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle();
  return (data?.preferences as Record<string, unknown> | null) ?? {};
}

async function writeBlocks(supabase: Client, ownerId: string, preferences: Record<string, unknown>, blocks: RoutineBlock[]): Promise<boolean> {
  const { error } = await supabase
    .from("user_settings")
    .upsert({ owner_id: ownerId, preferences: { ...preferences, routineBlocks: blocks } as unknown as Json }, { onConflict: "owner_id" });
  return !error;
}

function revalidateRoutine() {
  revalidatePath("/rotina");
  revalidatePath("/hoje");
  revalidatePath("/agenda");
}

const saveInputSchema = routineBlockFields.extend({ id: z.string().min(1).max(64).optional() });

/** Cria ou edita um bloco da rotina por horário (10.2). */
export async function saveRoutineBlock(input: unknown): Promise<Result<RoutineBlock[]>> {
  const draft = saveInputSchema.safeParse(input);
  if (!draft.success) return fail(draft.error.issues[0]?.message ?? "Dados inválidos.");
  const parsed = routineBlockSchema.safeParse({ ...draft.data, id: draft.data.id ?? crypto.randomUUID() });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const { supabase, user } = await requireOwner();
  const preferences = await readPreferences(supabase, user.id);
  const current = parseRoutineBlocks(preferences.routineBlocks);
  const isNew = !current.some((b) => b.id === parsed.data.id);
  if (isNew && current.length >= MAX_ROUTINE_BLOCKS) return fail(`Limite de ${MAX_ROUTINE_BLOCKS} blocos na rotina.`);

  const next = upsertBlock(current, parsed.data);
  if (!(await writeBlocks(supabase, user.id, preferences, next))) return fail("Não foi possível salvar.");
  revalidateRoutine();
  return ok(next);
}

export async function deleteRoutineBlock(id: unknown): Promise<Result<RoutineBlock[]>> {
  const parsed = z.string().min(1).max(64).safeParse(id);
  if (!parsed.success) return fail("Bloco inválido.");

  const { supabase, user } = await requireOwner();
  const preferences = await readPreferences(supabase, user.id);
  const next = removeBlock(parseRoutineBlocks(preferences.routineBlocks), parsed.data);
  if (!(await writeBlocks(supabase, user.id, preferences, next))) return fail("Não foi possível apagar.");
  revalidateRoutine();
  return ok(next);
}
