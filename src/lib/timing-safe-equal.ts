import { timingSafeEqual } from "node:crypto";

/**
 * Compara dois segredos em tempo constante (CLAUDE.md: "Comparação de
 * segredos com crypto.timingSafeEqual"). `crypto.timingSafeEqual` lança se
 * os buffers tiverem tamanhos diferentes — o `false` antecipado aqui evita
 * isso; o tamanho em si não é segredo, só o conteúdo.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
