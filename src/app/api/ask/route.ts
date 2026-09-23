import { z } from "zod";
import { NextResponse } from "next/server";
import { buildAskContext, selectChunksWithinBudget } from "@/features/ai/lib/ask-context";
import { buildAskSystemPrompt } from "@/features/ai/lib/ask-system-prompt";
import { buildAskTools } from "@/features/ai/lib/ask-tools";
import { reformulateQuery } from "@/features/ai/lib/reformulate-query";
import { fetchItemLabels, retrieveChunks, type AskScope } from "@/features/ai/lib/retrieve";
import { getConversationHistory, getOrCreateConversation, getUserTimezone, saveMessage } from "@/features/ai/queries";
import { requireOwner } from "@/lib/auth";
import { AiBudgetExceededError, AiDisabledError, streamAskWithTools } from "@/lib/ai/claude";

/** Chamada de IA com várias rodadas de ferramenta (6.7) pode passar dos 10s padrão do plano Hobby. */
export const maxDuration = 60;

const askScopeSchema = z.object({
  spaceIds: z.array(z.string().uuid()).optional(),
  typeIds: z.array(z.string().uuid()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  /** Escopo "este item e relacionados" (painel lateral do item) — ids fixos. */
  itemIds: z.array(z.string().uuid()).optional(),
});

const askRequestSchema = z.object({
  question: z.string().trim().min(1, "Digite uma pergunta.").max(4000),
  conversationId: z.string().uuid().nullable().optional(),
  scope: askScopeSchema.optional(),
});

function encodeLine(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
}

/**
 * "Pergunte à sua base" (6.7) — NDJSON em streaming (uma linha JSON por
 * evento, sem framework de SSE: `{type:"conversation"|"sources"|"delta"|"tool"|"done"|"error"}`).
 * Erros depois que o streaming já começou (módulo de IA desligado, orçamento
 * estourado, falha do provedor) viram uma linha `error` em vez de um status
 * HTTP — os cabeçalhos da resposta já foram enviados antes de qualquer coisa
 * poder falhar (a chamada ao Claude só acontece dentro do `ReadableStream`).
 */
export async function POST(request: Request) {
  const { supabase, user } = await requireOwner();

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = askRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { question, conversationId: requestedConversationId } = parsed.data;
  const scope: AskScope = parsed.data.scope ?? {};
  const ownerId = user.id;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => controller.enqueue(encodeLine(payload));

      try {
        const timezone = await getUserTimezone(supabase, ownerId);
        const conversationId = await getOrCreateConversation(supabase, ownerId, requestedConversationId ?? null, scope);
        send({ type: "conversation", conversationId });

        const history = await getConversationHistory(supabase, conversationId);
        await saveMessage(supabase, ownerId, conversationId, "user", question);

        const searchQuery = await reformulateQuery(ownerId, question, history);
        const retrieved = await retrieveChunks(supabase, searchQuery, scope, timezone);
        const selected = selectChunksWithinBudget(retrieved);
        const itemLabels = await fetchItemLabels(supabase, [...new Set(selected.map((chunk) => chunk.itemId))]);
        const { contextText, sources } = buildAskContext(selected, itemLabels);
        send({ type: "sources", sources });

        const tools = await buildAskTools(supabase, ownerId, timezone);
        const system = buildAskSystemPrompt(contextText, timezone, tools.length > 0);
        const result = await streamAskWithTools({
          ownerId,
          feature: "ask_knowledge_base",
          system,
          messages: [...history.map((turn) => ({ role: turn.role, content: turn.content })), { role: "user" as const, content: question }],
          tools,
          onTextDelta: (delta) => send({ type: "delta", text: delta }),
          onToolUse: (name) => send({ type: "tool", name }),
        });

        await saveMessage(supabase, ownerId, conversationId, "assistant", result.text, sources);
        send({ type: "done" });
      } catch (err) {
        const message = err instanceof AiDisabledError || err instanceof AiBudgetExceededError ? err.message : "Não foi possível responder. Tente de novo em instantes.";
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
