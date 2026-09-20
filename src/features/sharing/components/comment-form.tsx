"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitShareComment } from "../actions-public";

/** Formulário "nome + mensagem" (3.11, permissão `comment`) — aparece pro dono no item. */
export function CommentForm({ token }: { token: string }) {
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    startTransition(async () => {
      const result = await submitShareComment(token, { authorName, body });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      setSent(true);
      setBody("");
    });
  }

  if (sent) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Comentário enviado. Obrigado!</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">Deixar um comentário</h2>
      <input
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
        placeholder="Seu nome"
        disabled={pending}
        className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20"
      />
      {fieldErrors.authorName && <span className="text-xs text-red-500">{fieldErrors.authorName[0]}</span>}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Mensagem"
        rows={3}
        disabled={pending}
        className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20"
      />
      {fieldErrors.body && <span className="text-xs text-red-500">{fieldErrors.body[0]}</span>}
      <button
        type="submit"
        disabled={pending || !authorName.trim() || !body.trim()}
        className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Enviar"}
      </button>
    </form>
  );
}
