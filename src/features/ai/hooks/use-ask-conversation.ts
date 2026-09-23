"use client";

import { useCallback, useState } from "react";
import type { AskSource } from "@/features/ai/lib/ask-context";
import { readNdjsonStream } from "@/features/ai/lib/ndjson-stream";
import type { AskScope } from "@/features/ai/lib/retrieve";

export interface AskMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: AskSource[];
  pending?: boolean;
}

function randomId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

/**
 * Estado + envio de uma conversa de "Pergunte à sua base" (6.7) — usado tanto
 * pela página `/perguntar` quanto pelo painel do item (escopo diferente, mesmo
 * protocolo). Lê `/api/ask` como NDJSON (`readNdjsonStream`) e vai atualizando
 * a última mensagem do assistente a cada `delta`, sem esperar o fim da resposta.
 */
export function useAskConversation(scope: AskScope, initialConversationId: string | null = null) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (question: string) => {
      setError(null);
      setIsStreaming(true);

      const userMessage: AskMessage = { id: randomId(), role: "user", content: question, sources: [] };
      const assistantId = randomId();
      setMessages((prev) => [...prev, userMessage, { id: assistantId, role: "assistant", content: "", sources: [], pending: true }]);

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, conversationId, scope }),
        });
        if (!response.ok || !response.body) throw new Error("sem corpo de resposta");

        for await (const event of readNdjsonStream(response.body)) {
          if (event.type === "conversation" && typeof event.conversationId === "string") {
            setConversationId(event.conversationId);
          } else if (event.type === "sources" && Array.isArray(event.sources)) {
            const sources = event.sources as AskSource[];
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, sources } : m)));
          } else if (event.type === "delta" && typeof event.text === "string") {
            const delta = event.text;
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m)));
          } else if (event.type === "error" && typeof event.error === "string") {
            setError(event.error);
          }
        }
      } catch {
        setError("Não foi possível responder. Tente de novo em instantes.");
      } finally {
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)));
        setIsStreaming(false);
      }
    },
    [conversationId, scope],
  );

  const reset = useCallback((newConversationId: string | null, newMessages: AskMessage[] = []) => {
    setConversationId(newConversationId);
    setMessages(newMessages);
    setError(null);
  }, []);

  return { conversationId, messages, isStreaming, error, send, reset };
}
