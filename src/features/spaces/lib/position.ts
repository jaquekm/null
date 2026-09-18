/**
 * Nova `position` de um espaço (ou item) ao ser solto entre dois vizinhos
 * numa lista reordenável: a média dos dois, ou 1 acima/abaixo do único
 * vizinho existente quando solto numa ponta da lista.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return after! - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}
