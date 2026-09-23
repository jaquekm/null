export const SUGGEST_CONNECTION_SYSTEM = [
  "Você explica, em português do Brasil, por que dois itens de uma base de notas pessoal podem estar relacionados.",
  "Responda em uma frase curta (até 25 palavras), direto ao ponto, só a partir do que os dois textos têm em comum.",
  "Se não conseguir identificar uma relação clara nos textos, diga isso em vez de inventar uma.",
].join("\n");

const EXCERPT_CHARS = 1500;

/** Recorte de cada item pro contexto — a explicação é sempre curta, não precisa do conteúdo inteiro pra chegar num motivo plausível. */
export function buildSuggestConnectionMessage(current: { title: string; contentText: string }, related: { title: string; contentText: string }): string {
  return [
    `Item A: "${current.title || "Sem título"}"`,
    current.contentText.slice(0, EXCERPT_CHARS) || "(sem conteúdo)",
    "",
    `Item B: "${related.title || "Sem título"}"`,
    related.contentText.slice(0, EXCERPT_CHARS) || "(sem conteúdo)",
  ].join("\n");
}
