import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { callClaude } from "@/lib/ai/claude";

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

const REFORMULATE_SYSTEM =
  "Você reescreve a última pergunta de uma conversa como uma única consulta de busca independente, em português do Brasil, incorporando qualquer contexto necessário do histórico (nomes, datas, o assunto em questão). Responda somente com a consulta reescrita — sem aspas, sem explicação, sem pontuação de pergunta.";

/**
 * Reformulação (6.7, passo 2, "opcional"): sem histórico a pergunta já é
 * independente, então pula a chamada extra ao Claude. Qualquer falha (IA
 * desligada, orçamento estourado, erro de rede) cai de volta pra pergunta
 * original — é uma otimização de busca, não deve derrubar a pergunta inteira;
 * a chamada principal (`streamAskWithTools`, 6.7) que segue depois é quem
 * decide se a pergunta pode ou não ser respondida.
 */
export async function reformulateQuery(ownerId: string, question: string, history: ConversationTurn[]): Promise<string> {
  if (history.length === 0) return question;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user" as const, content: `Pergunta atual: "${question}"` },
  ];

  try {
    const { text } = await callClaude({
      ownerId,
      feature: "ask_reformulate",
      system: REFORMULATE_SYSTEM,
      messages,
      maxTokens: 200,
    });
    return text.trim() || question;
  } catch {
    return question;
  }
}
