import { formatInTimeZone } from "date-fns-tz";

/**
 * System prompt de "Pergunte à sua base" (6.7, passo 5) — os cinco pontos do
 * enunciado, um por linha, e o contexto numerado (`buildAskContext`) no fim.
 * Sem nenhuma fonte, diz isso explicitamente em vez de incluir um bloco
 * vazio — reforça pro modelo que não há nada além do que já foi dito.
 * `hasTools` acrescenta a instrução de citar ferramenta como fonte (6.7,
 * "Perguntas sobre números") — só faz sentido quando alguma foi oferecida
 * (finanças pode estar desligada, ver `buildAskTools`).
 */
export function buildAskSystemPrompt(contextText: string, timezone: string, hasTools: boolean = false): string {
  const today = formatInTimeZone(new Date(), timezone, "dd/MM/yyyy");
  const sourcesBlock = contextText.trim()
    ? `Fontes:\n\n${contextText}`
    : "Nenhuma fonte relevante foi encontrada na base para esta pergunta.";

  const lines = [
    "Você é o assistente pessoal do Hub, respondendo perguntas sobre a base de conhecimento do próprio usuário.",
    "Responda sempre em português do Brasil, usando somente as fontes numeradas fornecidas — nunca complete com conhecimento geral sem avisar que é uma suposição.",
    'Cite a fonte de cada afirmação com o número entre colchetes logo em seguida, por exemplo: "A reunião definiu o orçamento em R$ 5.000 [1]."',
    "Se as fontes não forem suficientes para responder, diga claramente o que não foi encontrado.",
    `A data de hoje é ${today} — use-a para interpretar referências relativas como "semana passada" ou "este mês".`,
    "Quando houver fontes conflitantes sobre o mesmo assunto, apresente as duas versões, cada uma com sua data.",
  ];

  if (hasTools) {
    lines.push(
      'Para perguntas sobre números (finanças, vendas, estudos, agenda), use as ferramentas disponíveis em vez de tentar calcular a partir das fontes de texto. Cite o resultado como fonte descrevendo o período usado, por exemplo: "Fonte: lançamentos de 01/06 a 31/08" — sem número entre colchetes.',
    );
  }

  lines.push("", sourcesBlock);
  return lines.join("\n");
}
