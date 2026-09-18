/**
 * Ao mudar o tipo de um item (1.6: "manter propriedades compatíveis por
 * key"), mantém só os valores de `properties` cuja chave existe nos campos
 * do tipo novo — o resto pertencia só ao tipo antigo e não faz sentido
 * carregar adiante.
 */
export function remapProperties(
  currentProperties: Record<string, unknown>,
  newFieldKeys: string[],
): Record<string, unknown> {
  const keep = new Set(newFieldKeys);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(currentProperties)) {
    if (keep.has(key)) result[key] = value;
  }
  return result;
}
