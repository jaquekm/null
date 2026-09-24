import "server-only";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

const hits = new Map<string, number[]>();

/**
 * Limite de 120 chamadas/min por token (6.9), mesmo padrão de
 * `features/capture/lib/rate-limit.ts`/`features/sharing/lib/rate-limit.ts`:
 * em memória, por instância — melhor esforço, não um limite distribuído
 * exato (sem Redis/KV nesta stack).
 */
export function isMcpRateLimited(tokenId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(tokenId) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  recent.push(now);
  hits.set(tokenId, recent);
  return recent.length > MAX_REQUESTS;
}
