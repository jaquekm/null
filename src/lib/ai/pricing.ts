/**
 * Preço por milhão de tokens (USD), só entrada/saída base — sem os
 * multiplicadores de prompt caching, batch, fast mode etc., que este
 * projeto não usa. Conferido em platform.claude.com/docs/en/about-claude/pricing
 * em 2026-09-19; "fácil de atualizar" (enunciado da 2.3) — atualize aqui
 * quando os preços mudarem ou um modelo novo sair.
 */
const PRICE_PER_MILLION_TOKENS_USD: Record<string, { input: number; output: number }> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-mythos-5-1": { input: 10, output: 50 },
  "claude-fable-5": { input: 10, output: 50 },
  "claude-mythos-5": { input: 10, output: 50 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-opus-4-5": { input: 5, output: 25 },
  "claude-opus-4-5-20251101": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-sonnet-4-5-20250929": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

/**
 * Custo estimado de uma chamada, em USD. Modelo desconhecido (novo, ainda
 * não acrescentado à tabela acima) não trava a chamada — devolve `null` e
 * quem chama grava `cost_usd = null` em `usage_events` (uso registrado,
 * custo "desconhecido" em vez de errado).
 */
export function estimateCostUsd(model: string, usage: { input_tokens: number; output_tokens: number }): number | null {
  const price = PRICE_PER_MILLION_TOKENS_USD[model];
  if (!price) return null;

  return (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1_000_000;
}
