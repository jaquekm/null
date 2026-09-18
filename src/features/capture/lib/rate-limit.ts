import "server-only";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const hits = new Map<string, number[]>();

/**
 * Limite simples de 60 req/min por token (1.10). Em memória, por instância
 * do servidor — em serverless com várias instâncias frias isso é melhor
 * esforço, não um limite distribuído exato (não há Redis/KV nesta stack).
 */
export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_REQUESTS;
}
