"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import { registerFastingManuallySchema } from "./schemas";

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";
const PATH = "/hoje";

/** "Começar jejum" (10.11) — cria a sessão já no banco (não só em memória, como o cronômetro de Foco) pra sobreviver a recarregar a página. */
export async function startFasting(): Promise<Result<{ id: string; startedAt: string }>> {
  const { supabase, user } = await requireOwner();

  const { data: active } = await supabase.from("fasting_sessions").select("id").eq("owner_id", user.id).is("ended_at", null).limit(1);
  if (active && active.length > 0) return fail("Você já está em jejum.");

  const startedAt = new Date().toISOString();
  const { data, error } = await supabase.from("fasting_sessions").insert({ owner_id: user.id, started_at: startedAt }).select("id").single();
  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath(PATH);
  return ok({ id: data.id, startedAt });
}

/** "Terminar jejum" — fecha a sessão ativa e devolve a duração pro toast. */
export async function endFasting(): Promise<Result<{ durationMinutes: number }>> {
  const { supabase, user } = await requireOwner();

  const { data: active } = await supabase
    .from("fasting_sessions")
    .select("id, started_at")
    .eq("owner_id", user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!active) return fail("Nenhum jejum em andamento.");

  const endedAt = new Date();
  const { error } = await supabase.from("fasting_sessions").update({ ended_at: endedAt.toISOString() }).eq("id", active.id).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  const durationMinutes = Math.max(0, Math.round((endedAt.getTime() - new Date(active.started_at).getTime()) / 60_000));
  revalidatePath(PATH);
  return ok({ durationMinutes });
}

/** "Cancelar" um jejum começado por engano — some sem entrar no histórico (diferente de terminar, que sempre registra). */
export async function cancelFasting(): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("fasting_sessions").delete().eq("owner_id", user.id).is("ended_at", null);
  if (error) return fail("Não foi possível cancelar.");
  revalidatePath(PATH);
  return ok(null);
}

/** "Registrar manualmente" — pra um jejum que a dona esqueceu de iniciar pelo cronômetro, igual ao fallback do Foco (10.3). */
export async function registerFastingManually(input: z.input<typeof registerFastingManuallySchema>): Promise<Result<null>> {
  const parsed = registerFastingManuallySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("fasting_sessions")
    .insert({ owner_id: user.id, started_at: parsed.data.startedAt, ended_at: parsed.data.endedAt });
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(PATH);
  return ok(null);
}
