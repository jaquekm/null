import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { serverEnv } from "@/lib/env";

export interface EnqueueJobInput {
  ownerId: string;
  kind: string;
  payload?: Record<string, unknown>;
  runAfter?: Date;
  priority?: number;
  dedupeKey?: string;
  maxAttempts?: number;
}

/**
 * Enfileira um job (2.2). Ignora violação do índice único de `dedupe_key`
 * (`jobs_dedupe_idx`, 2.1) — significa que já existe um job equivalente
 * ativo na fila, não é erro. Quando o job já pode rodar agora, dispara um
 * `fetch` pro tick **sem esperar a resposta**, só pra acelerar o
 * processamento sem depender do cron (que roda a cada minuto) — se essa
 * chamada falhar ou for interrompida, o cron pega o job de qualquer forma.
 */
export async function enqueueJob(input: EnqueueJobInput): Promise<void> {
  const admin = createAdminClient();
  const runAfter = input.runAfter ?? new Date();

  const { error } = await admin.from("jobs").insert({
    owner_id: input.ownerId,
    kind: input.kind,
    payload: (input.payload ?? {}) as Json,
    run_after: runAfter.toISOString(),
    priority: input.priority ?? 100,
    dedupe_key: input.dedupeKey ?? null,
    max_attempts: input.maxAttempts ?? 5,
  });

  if (error) {
    if (error.code === "23505") return; // dedupe_key duplicado — job equivalente já na fila
    throw error;
  }

  if (runAfter.getTime() <= Date.now()) {
    void fetch(`${serverEnv.APP_URL}/api/jobs/tick`, {
      method: "POST",
      headers: { authorization: `Bearer ${serverEnv.CRON_SECRET}` },
    }).catch(() => {});
  }
}
