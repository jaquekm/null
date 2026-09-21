/**
 * Normaliza a descrição de um lançamento (maiúsculas, acentos, pontuação) pra
 * comparar duas descrições sem essas diferenças atrapalharem — usada tanto
 * pela sugestão de categoria do "Gasto rápido" (4.4, `suggest-category.ts`)
 * quanto pelo hash de deduplicação da importação de extratos (4.5,
 * `import-hash.ts`).
 */
export function normalizeDescription(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
