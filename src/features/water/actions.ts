"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { getUserTimezone } from "@/features/agenda/queries";
import { requireOwner } from "@/lib/auth";
import { todayInTimezone } from "@/lib/dates";
import { fail, ok, type Result } from "@/lib/result";
import type { Database, Json } from "@/lib/supabase/database.types";
import { addWaterSchema, setWaterGoalSchema } from "./schemas";

type Client = SupabaseClient<Database>;

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";

async function readPreferences(supabase: Client, ownerId: string): Promise<Record<string, unknown>> {
  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle();
  return (data?.preferences as Record<string, unknown> | null) ?? {};
}

/** "+250 ml" no Hoje (10.4) — soma no total do dia (não é atômico: um usuário só, clicando um botão por vez, o risco de duas gravações simultâneas é desprezível e não justifica uma função SQL só pra isso). */
export async function addWater(input: z.input<typeof addWaterSchema>): Promise<Result<{ totalMl: number }>> {
  const parsed = addWaterSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const timezone = await getUserTimezone(supabase, user.id);
  const day = todayInTimezone(timezone);

  const { data: current } = await supabase.from("water_logs").select("total_ml").eq("owner_id", user.id).eq("day", day).maybeSingle();
  const totalMl = (current?.total_ml ?? 0) + parsed.data.amountMl;

  const { error } = await supabase.from("water_logs").upsert({ owner_id: user.id, day, total_ml: totalMl }, { onConflict: "owner_id,day" });
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/hoje");
  return ok({ totalMl });
}

/** Meta diária editável (10.4) — guardada em `user_settings.preferences.waterGoalMl`, mesmo lugar das outras preferências pequenas da dona (9.8/10.2). */
export async function setWaterGoal(input: z.input<typeof setWaterGoalSchema>): Promise<Result<null>> {
  const parsed = setWaterGoalSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const preferences = await readPreferences(supabase, user.id);
  const { error } = await supabase
    .from("user_settings")
    .upsert({ owner_id: user.id, preferences: { ...preferences, waterGoalMl: parsed.data.goalMl } as unknown as Json }, { onConflict: "owner_id" });
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/hoje");
  return ok(null);
}
