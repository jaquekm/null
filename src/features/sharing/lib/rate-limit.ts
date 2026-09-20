/**
 * Limite de taxa por IP pra `/p/[token]` (3.11) — janela deslizante em
 * memória do processo. **Simplificação assumida**: não é compartilhado
 * entre instâncias serverless (cada uma tem seu próprio contador) nem
 * sobrevive a um redeploy — pra um app de um usuário só, isso ainda
 * dificulta um brute-force de verdade (cada instância já limita sozinha) e
 * evita depender de um serviço externo (Redis/Upstash) só pra isso. Se
 * abuso real aparecer, revisitar com um contador no banco.
 */
export function createRateLimiter(maxAttempts: number, windowMs: number) {
  const hits = new Map<string, number[]>();

  return function check(key: string, now: number = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
    recent.push(now);
    hits.set(key, recent);
    return recent.length > maxAttempts;
  };
}
