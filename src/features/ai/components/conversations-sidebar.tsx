"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteConversationAction, renameConversationAction } from "@/features/ai/actions";
import type { ConversationSummaryRow } from "@/features/ai/queries";

interface ConversationsSidebarProps {
  conversations: ConversationSummaryRow[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
}

/** Lateral de conversas salvas (6.7): renomear (input inline) e excluir — mesmo padrão de `ReportDefinitionsList`. */
export function ConversationsSidebar({ conversations, activeConversationId, onSelect, onNewConversation }: ConversationsSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function startRename(conversation: ConversationSummaryRow) {
    setEditingId(conversation.id);
    setDraftTitle(conversation.title ?? "");
  }

  function confirmRename(id: string) {
    const title = draftTitle.trim();
    if (!title) {
      setEditingId(null);
      return;
    }
    startTransition(async () => {
      const result = await renameConversationAction(id, { title });
      setEditingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteConversationAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (activeConversationId === id) onNewConversation();
      router.refresh();
    });
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-64 sm:shrink-0">
      <button type="button" onClick={onNewConversation} className="rounded-full border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
        Nova conversa
      </button>

      {conversations.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Nenhuma conversa salva ainda.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {conversations.map((conversation) => (
            <li key={conversation.id} className={`rounded-lg px-2 py-1.5 text-sm ${activeConversationId === conversation.id ? "bg-black/[.06] dark:bg-white/[.08]" : ""}`}>
              {editingId === conversation.id ? (
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onBlur={() => confirmRename(conversation.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRename(conversation.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="w-full rounded border border-black/[.12] bg-transparent px-1.5 py-0.5 text-sm dark:border-white/[.16]"
                />
              ) : (
                <div className="flex items-center justify-between gap-1">
                  <button type="button" onClick={() => onSelect(conversation.id)} className="min-w-0 flex-1 truncate text-left">
                    {conversation.title || "Sem título"}
                  </button>
                  <div className="flex shrink-0 gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <button type="button" onClick={() => startRename(conversation)} disabled={pending} className="hover:text-black dark:hover:text-zinc-50">
                      Renomear
                    </button>
                    <button type="button" onClick={() => handleDelete(conversation.id)} disabled={pending} className="hover:text-red-600 dark:hover:text-red-400">
                      Excluir
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
