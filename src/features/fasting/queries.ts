import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { averageDurationMinutes } from "./lib/fasting";

type Client = SupabaseClient<Database>;

const HISTORY_LIMIT = 7;

export interface FastingHistoryEntry {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
}

export interface FastingData {
  /** Jejum em andamento (`ended_at` ainda nulo) — `null` se nenhum. */
  active: { id: string; startedAt: string } | null;
  /** Últimos jejuns terminados, do mais recente pro mais antigo. */
  history: FastingHistoryEntry[];
  /** Média de duração dos jejuns em `history` — `null` sem nenhum ainda. */
  averageMinutes: number | null;
}

/** Card "Jejum" no Hoje (10.11): a sessão ativa (se tiver) e o histórico recente. */
export async function getFastingData(supabase: Client, ownerId: string): Promise<FastingData> {
  const [activeResult, historyResult] = await Promise.all([
    supabase.from("fasting_sessions").select("id, started_at").eq("owner_id", ownerId).is("ended_at", null).order("started_at", { ascending: false }).limit(1),
    supabase
      .from("fasting_sessions")
      .select("id, started_at, ended_at")
      .eq("owner_id", ownerId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  const active = activeResult.data?.[0] ? { id: activeResult.data[0].id, startedAt: activeResult.data[0].started_at } : null;

  const history: FastingHistoryEntry[] = (historyResult.data ?? []).map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at!,
    durationMinutes: Math.max(0, Math.round((new Date(row.ended_at!).getTime() - new Date(row.started_at).getTime()) / 60_000)),
  }));

  return { active, history, averageMinutes: averageDurationMinutes(history.map((h) => h.durationMinutes)) };
}
