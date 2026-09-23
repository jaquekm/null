"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { loadConversationMessages } from "@/features/ai/actions";
import { AskMessageBubble } from "@/features/ai/components/ask-message";
import { AskScopePicker } from "@/features/ai/components/ask-scope-picker";
import { ConversationsSidebar } from "@/features/ai/components/conversations-sidebar";
import { useAskConversation } from "@/features/ai/hooks/use-ask-conversation";
import type { AskScope } from "@/features/ai/lib/retrieve";
import type { ConversationSummaryRow } from "@/features/ai/queries";
import type { TypeOptionWithFields } from "@/features/items/queries";
import type { SidebarSpace } from "@/features/spaces/queries";

function suggestedQuestions(financeAiEnabled: boolean): string[] {
  const base = ["O que ficou pendente esta semana?", "Resuma as últimas reuniões.", "O que tenho agendado nos próximos dias?"];
  if (financeAiEnabled) base.push("Quanto gastei com delivery nos últimos 3 meses?");
  return base;
}

interface AskWorkspaceProps {
  conversations: ConversationSummaryRow[];
  spaces: SidebarSpace[];
  types: TypeOptionWithFields[];
  financeAiEnabled: boolean;
}

/** Página `/perguntar` (6.7) — escopo, conversa em streaming e lateral de conversas salvas. */
export function AskWorkspace({ conversations, spaces, types, financeAiEnabled }: AskWorkspaceProps) {
  const [scope, setScope] = useState<AskScope>({});
  const [question, setQuestion] = useState("");
  const { conversationId, messages, isStreaming, error, send, reset } = useAskConversation(scope);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSelectConversation(id: string) {
    const conversation = conversations.find((c) => c.id === id);
    const result = await loadConversationMessages(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    reset(
      id,
      result.data.map((m) => ({ id: m.id, role: m.role, content: m.content, sources: m.citations })),
    );
    if (conversation) setScope(conversation.scope);
  }

  function handleNewConversation() {
    reset(null, []);
    setScope({});
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isStreaming) return;
    setQuestion("");
    void send(trimmed);
  }

  /** Última pergunta antes da resposta em `index` — as ações da resposta (Salvar como nota/Criar tarefa) usam esse texto. */
  function questionFor(index: number): string {
    for (let i = index; i >= 0; i--) {
      if (messages[i]?.role === "user") return messages[i]!.content;
    }
    return "";
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6 sm:flex-row">
      <ConversationsSidebar conversations={conversations} activeConversationId={conversationId} onSelect={handleSelectConversation} onNewConversation={handleNewConversation} />

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Pergunte à sua base</h1>

        <AskScopePicker spaces={spaces} types={types} scope={scope} onChange={setScope} disabled={messages.length > 0} />

        <div className="flex min-h-[50vh] flex-col gap-3 overflow-y-auto rounded-xl border border-black/[.08] p-4 dark:border-white/[.08]">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Perguntas sugeridas:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions(financeAiEnabled).map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => void send(suggestion)} className="rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => <AskMessageBubble key={message.id} question={questionFor(index)} message={message} />)
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pergunte alguma coisa sobre sua base..."
            disabled={isStreaming}
            className="flex-1 rounded-full border border-black/[.12] bg-transparent px-4 py-2 text-sm dark:border-white/[.16]"
          />
          <button type="submit" disabled={isStreaming || !question.trim()} className="rounded-full border border-black/[.12] px-4 py-2 text-sm dark:border-white/[.16]">
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
