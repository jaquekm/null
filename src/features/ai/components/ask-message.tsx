"use client";

import Link from "next/link";
import { Fragment, useTransition } from "react";
import { toast } from "sonner";
import { createTaskFromAnswerAction, saveAnswerAsNoteAction } from "@/features/ai/actions";
import type { AskSource } from "@/features/ai/lib/ask-context";
import { buildCitationHref, findCitationMatches } from "@/features/ai/lib/citation-links";
import type { AskMessage } from "@/features/ai/hooks/use-ask-conversation";

function citationTitle(source: AskSource): string {
  const location = source.location ? ` — ${source.location}` : "";
  return `${source.title}${location}\n${source.excerpt}`;
}

/** Marca `[n]` na resposta como link pro item (6.7, passo 7) — prévia no `title` nativo (sem componente de tooltip no projeto). */
function MessageText({ content, sources }: { content: string; sources: AskSource[] }) {
  const matches = findCitationMatches(content, sources);
  if (matches.length === 0) return <p className="whitespace-pre-wrap text-sm">{content}</p>;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    if (match.index > cursor) nodes.push(<Fragment key={`text-${index}`}>{content.slice(cursor, match.index)}</Fragment>);
    nodes.push(
      match.source ? (
        <Link
          key={`citation-${index}`}
          href={buildCitationHref(match.source)}
          title={citationTitle(match.source)}
          className="mx-0.5 rounded bg-black/[.06] px-1 text-xs font-medium text-black no-underline hover:bg-black/[.12] dark:bg-white/[.1] dark:text-zinc-50"
        >
          {match.raw}
        </Link>
      ) : (
        <Fragment key={`citation-${index}`}>{match.raw}</Fragment>
      ),
    );
    cursor = match.index + match.raw.length;
  });
  if (cursor < content.length) nodes.push(<Fragment key="text-end">{content.slice(cursor)}</Fragment>);

  return <p className="whitespace-pre-wrap text-sm">{nodes}</p>;
}

/** Ações sobre a resposta (6.7): copiar, "Salvar como nota" (cria item + liga às fontes), "Criar tarefa". */
function MessageActions({ question, message }: { question: string; message: AskMessage }) {
  const [isPending, startTransition] = useTransition();

  function handleCopy() {
    navigator.clipboard.writeText(message.content).then(
      () => toast.success("Copiado."),
      () => toast.error("Não foi possível copiar."),
    );
  }

  function handleSaveAsNote() {
    startTransition(async () => {
      const result = await saveAnswerAsNoteAction({ question, answer: message.content, sources: message.sources.map((s) => ({ itemId: s.itemId, title: s.title })) });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Nota salva.");
    });
  }

  function handleCreateTask() {
    const title = window.prompt("Título da tarefa:", question.length > 100 ? `${question.slice(0, 100)}…` : question);
    if (!title || !title.trim()) return;
    startTransition(async () => {
      const result = await createTaskFromAnswerAction({ title: title.trim(), answer: message.content });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tarefa criada.");
    });
  }

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button type="button" onClick={handleCopy} disabled={isPending} className="rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]">
        Copiar
      </button>
      <button type="button" onClick={handleSaveAsNote} disabled={isPending} className="rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]">
        Salvar como nota
      </button>
      <button type="button" onClick={handleCreateTask} disabled={isPending} className="rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]">
        Criar tarefa
      </button>
    </div>
  );
}

export function AskMessageBubble({ question, message }: { question: string; message: AskMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex flex-col gap-1 rounded-2xl px-4 py-2.5 ${isUser ? "self-end bg-black text-white dark:bg-zinc-50 dark:text-black" : "self-start bg-black/[.04] dark:bg-white/[.06]"}`}>
      {message.pending && !message.content ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Pensando…</p>
      ) : isUser ? (
        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
      ) : (
        <MessageText content={message.content} sources={message.sources} />
      )}
      {!isUser && !message.pending && message.content && <MessageActions question={question} message={message} />}
    </div>
  );
}
