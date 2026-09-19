import { computeBackoffSeconds } from "./backoff";
import type { JobOutcome } from "./types";

export interface JobTransition {
  status: "done" | "queued" | "failed";
  finishedAt?: string;
  runAfter?: string;
  lastError?: string;
  result?: unknown;
}

/**
 * Traduz o resultado de um handler (ou de uma exceção não tratada, já
 * normalizada pra `retry` por quem chama) num conjunto de colunas pra
 * atualizar em `jobs` — função pura, sem tocar no banco, pra dar pra testar
 * isolada (critério de aceite da 2.2).
 *
 * `done` sempre termina o job. `failed` também termina, **sem** tentar de
 * novo, mesmo com tentativas sobrando — é a decisão do próprio handler (ex.:
 * orçamento de IA estourado, 2.3, não adianta tentar de novo). Só `retry`
 * consulta `attempts`/`maxAttempts`: enquanto sobrar tentativa, volta pra
 * `queued` com o atraso do backoff (ou o `delaySeconds` que o handler pediu);
 * esgotadas as tentativas, vira `failed`.
 */
export function resolveJobTransition(
  job: { attempts: number; maxAttempts: number },
  outcome: JobOutcome,
  now: Date = new Date(),
): JobTransition {
  if (outcome.status === "done") {
    return { status: "done", finishedAt: now.toISOString(), result: outcome.result };
  }

  if (outcome.status === "failed") {
    return { status: "failed", finishedAt: now.toISOString(), lastError: outcome.error };
  }

  if (job.attempts < job.maxAttempts) {
    const delaySeconds = outcome.delaySeconds ?? computeBackoffSeconds(job.attempts);
    return {
      status: "queued",
      runAfter: new Date(now.getTime() + delaySeconds * 1000).toISOString(),
      lastError: outcome.error,
    };
  }

  return { status: "failed", finishedAt: now.toISOString(), lastError: outcome.error };
}
