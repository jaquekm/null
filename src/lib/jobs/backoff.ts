/**
 * Backoff exponencial do enunciado da 2.2: `2^attempts` minutos, no máximo
 * 60 — usado quando um `retry` não vem com `delaySeconds` próprio.
 */
export function computeBackoffSeconds(attempts: number): number {
  const minutes = Math.min(2 ** attempts, 60);
  return minutes * 60;
}
