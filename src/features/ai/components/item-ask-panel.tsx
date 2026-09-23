"use client";

import { useState, type FormEvent } from "react";
import { AskMessageBubble } from "@/features/ai/components/ask-message";
import { useAskConversation } from "@/features/ai/hooks/use-ask-conversation";
import type { AskScope } from "@/features/ai/lib/retrieve";

interface ItemAskPanelProps {
  itemId: string;
  relatedItemIds: string[];
}

/**
 * "Pergunte sobre este item" (6.7, painel lateral acessível de qualquer
 * item) — escopo fixo "este item e relacionados" (`AskScope.itemIds`, sem
 * seletor: já é o escopo). Recolhido por padrão, mesmo estilo de seção de
 * `RelatedItemsPanel` (6.6) — sem componente de collapse/accordion no
 * projeto, um `useState` local basta.
 */
export function ItemAskPanel({ itemId, relatedItemIds }: ItemAskPanelProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const scope: AskScope = { itemIds: [itemId, ...relatedItemIds] };
  const { messages, isStreaming, error, send } = useAskConversation(scope);

  function questionFor(index: number): string {
    for (let i = index; i >= 0; i--) {
      if (messages[i]?.role === "user") return messages[i]!.content;
    }
    return "";
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isStreaming) return;
    setQuestion("");
    void send(trimmed);
  }

  return (
    <section className="flex flex-col gap-2">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center justify-between text-sm font-medium text-black dark:text-zinc-50">
        Pergunte sobre este item
        <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">{open ? "Recolher" : "Expandir"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 rounded-xl border border-black/[.08] p-3 dark:border-white/[.08]">
          {messages.length === 0 && <p className="text-xs text-zinc-500 dark:text-zinc-400">Pergunte algo sobre este item ou os relacionados a ele.</p>}
          {messages.map((message, index) => (
            <AskMessageBubble key={message.id} question={questionFor(index)} message={message} />
          ))}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Pergunte sobre este item..."
              disabled={isStreaming}
              className="flex-1 rounded-full border border-black/[.12] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.16]"
            />
            <button type="submit" disabled={isStreaming || !question.trim()} className="rounded-full border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
              Enviar
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
