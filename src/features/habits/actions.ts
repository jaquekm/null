"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { z } from "zod";
import { installPack } from "@/features/packs/lib/install";
import { listLocalPacks } from "@/features/packs/queries";
import { toggleHabitDay } from "./lib/habit-log";
import { frequencyFromWeekdays, WEEKDAYS } from "./lib/habit-week";

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
  revalidatePath("/rotina");
  revalidatePath("/hoje");
  return ok({ logged: Boolean(nextLog[dateStr]) });
}

const weekdaysSchema = z.array(z.enum(WEEKDAYS)).max(7);

const createHabitSchema = z.object({
  title: z.string().trim().min(1, "Dê um nome ao hábito.").max(120),
  days: weekdaysSchema.default([]),
});

/**
 * "+ Hábito" da Rotina (10.1). Sem o tipo Hábito ainda, instala o pacote
 * "Diário e hábitos" (5.12) antes — o mesmo que Configurações → Métodos faria.
 */
export async function createHabit(input: z.input<typeof createHabitSchema>): Promise<Result<{ id: string }>> {
  const parsed = createHabitSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const { supabase, user } = await requireOwner();
  let typeId = await findHabitTypeId(supabase);
  if (!typeId) {
    const pack = (await listLocalPacks()).find((entry) => entry.pack?.key === "diario-habitos")?.pack;
    if (!pack) return fail("Não achei o pacote de hábitos.");
    const installed = await installPack(supabase, user.id, pack, { spaceId: null });
    if (!installed.ok) return fail("Não foi possível preparar os hábitos. Tente de novo.");
    typeId = await findHabitTypeId(supabase);
    if (!typeId) return fail("Não foi possível preparar os hábitos. Tente de novo.");
  }

  const { data, error } = await supabase
    .from("items")
    .insert({
      owner_id: user.id,
      title: parsed.data.title,
      type_id: typeId,
      status: "active",
      source: "rotina",
      properties: { frequency: frequencyFromWeekdays(parsed.data.days), log: {} } as unknown as Json,
    })
    .select("id")
    .single();
  if (error || !data) return fail("Não foi possível criar o hábito.");

  revalidatePath("/rotina");
  return ok({ id: data.id });
}

/** Dias da semana do hábito (10.1) — grava em `properties.frequency` no formato que o pack já usa. */
export async function setHabitDays(itemId: string, days: unknown): Promise<Result<null>> {
  const parsed = weekdaysSchema.safeParse(days);
  if (!parsed.success) return fail("Dias inválidos.");

  const { supabase, user } = await requireOwner();
  const { data: item } = await supabase.from("items").select("properties").eq("id", itemId).eq("owner_id", user.id).maybeSingle();
  if (!item) return fail("Hábito não encontrado.");

  const properties = { ...((item.properties as Record<string, unknown> | null) ?? {}), frequency: frequencyFromWeekdays(parsed.data) };
  const { error } = await supabase.from("items").update({ properties: properties as unknown as Json }).eq("id", itemId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível salvar.");

  revalidatePath("/rotina");
  return ok(null);
}

/** "Excluir hábito" direto na Rotina (ajuste pedido pela dona — antes só dava pra excluir abrindo o item). Exclusão lógica, igual a qualquer item (vai pra lixeira). */
export async function deleteHabit(itemId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase.from("items").update({ deleted_at: new Date().toISOString() }).eq("id", itemId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível excluir o hábito.");

  revalidatePath("/rotina");
  revalidatePath("/hoje");
  return ok(null);
}

async function findHabitTypeId(supabase: Awaited<ReturnType<typeof requireOwner>>["supabase"]): Promise<string | null> {
  const { data } = await supabase.from("object_types").select("id").eq("slug", "habito").is("archived_at", null).order("created_at", { ascending: true }).limit(1);
  return data?.[0]?.id ?? null;
}
