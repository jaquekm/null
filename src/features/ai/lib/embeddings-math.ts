/**
 * Média elemento a elemento de vários embeddings (6.6, "itens relacionados":
 * "média dos embeddings dos trechos do item"). `null` sem nenhum vetor —
 * quem chama decide o que fazer (ex.: item ainda não indexado).
 */
export function averageEmbedding(vectors: number[][]): number[] | null {
  if (vectors.length === 0) return null;
  if (vectors.length === 1) return vectors[0]!;

  const dimensions = vectors[0]!.length;
  const sum = new Array<number>(dimensions).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i++) sum[i] = sum[i]! + vector[i]!;
  }

  return sum.map((value) => value / vectors.length);
}
