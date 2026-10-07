"use client";

import { Check, Pencil, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AuthorChip, LinkedText } from "@/features/items/components/list-entry-bits";
import type { ListStyle } from "@/features/items/lib/list-styles";
import { editSharedList } from "../actions-public";
import type { ListEditOp } from "../lib/list-edit";

/** O que a página pública entrega por item — sem o id do link de quem adicionou. */
export interface SharedListEntry {
  index: number;
  text: string;
  checked: boolean;
  score: number | null;
  details: string;
  author: string | null;
  scoreBy: string | null;
  /** Adicionado por esse mesmo link: só esses a pessoa edita e apaga. */
  mine: boolean;
}

const fieldClassName =
  "w-full rounded-lg border border-black/[.12] bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-white/[.16]";

/**
 * Lista compartilhada com permissão de edição (07/10): quem recebe o link
 * adiciona itens, dá nota, marca e edita/apaga só o que adicionou. O nome dele
 * (o do link) fica em cada item e em cada nota, e a dona vê quem fez o quê.
 */
export function SharedListEditor({
  token,
  title,
  style,
  entries,
  viewerName,
}: {
  token: string;
  title: string;
  style: ListStyle;
  entries: SharedListEntry[];
  viewerName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<number | null>(null);
  const [newText, setNewText] = useState("");

  const shown = style === "rating" ? [...entries].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.index - b.index) : entries;

  function run(op: ListEditOp, after?: () => void) {
    startTransition(async () => {
      const result = await editSharedList(token, op);
      if (!result.ok) toast.error(result.error);
      else after?.();
      router.refresh();
    });
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    const text = newText.trim();
    if (!text) return;
    run({ op: "add", text }, () => setNewText(""));
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-black dark:text-zinc-50">{title}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Você está como <strong>{viewerName}</strong>. O que você adicionar ou avaliar fica com o seu nome. Você só edita e apaga o que você adicionou.
        </p>
      </header>

      <ul className="flex flex-col gap-2">
        {shown.map((entry, position) =>
          editing === entry.index ? (
            <li key={entry.index}>
              <EntryForm
                entry={entry}
                pending={pending}
                onCancel={() => setEditing(null)}
                onSave={(text, details) => run({ op: "edit", index: entry.index, expectText: entry.text, text, details }, () => setEditing(null))}
              />
            </li>
          ) : (
            <li key={entry.index} className="flex flex-col gap-1.5 rounded-xl border border-black/[.08] bg-surface p-3 shadow-sm dark:border-white/[.08]">
              <div className="flex items-start gap-2">
                {style === "priority" && <span className="w-6 shrink-0 pt-0.5 text-center text-sm font-semibold tabular-nums text-zinc-500">{position + 1}</span>}
                {(style === "checklist" || style === "multi" || style === "single") && (
                  <button
                    type="button"
                    role={style === "single" ? "radio" : "checkbox"}
                    aria-checked={entry.checked}
                    aria-label={`Marcar ${entry.text}`}
                    disabled={pending}
                    onClick={() => run({ op: "toggle", index: entry.index, expectText: entry.text })}
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2 ${style === "multi" ? "rounded-md" : "rounded-full"} ${
                      entry.checked ? "border-brand bg-brand text-white" : "border-black/25 dark:border-white/25"
                    }`}
                  >
                    {entry.checked && <Check className="h-4 w-4" />}
                  </button>
                )}
                <p className={`min-w-0 flex-1 break-words font-semibold leading-snug ${style === "checklist" && entry.checked ? "text-zinc-400 line-through" : ""}`}>
                  {entry.text}
                  {entry.author && <AuthorChip name={entry.author} />}
                </p>
                {style === "rating" && (
                  <div className="flex shrink-0 flex-col items-end">
                    <span role="group" aria-label={`Nota de ${entry.text}`} className="flex">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          disabled={pending}
                          aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
                          aria-pressed={entry.score === n}
                          onClick={() => run({ op: "rate", index: entry.index, expectText: entry.text, score: entry.score === n ? null : n })}
                          className="p-0.5"
                        >
                          <Star className={`h-6 w-6 ${(entry.score ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-600"}`} />
                        </button>
                      ))}
                    </span>
                    {entry.scoreBy && <span className="text-xs text-zinc-500 dark:text-zinc-400">nota de {entry.scoreBy}</span>}
                  </div>
                )}
              </div>
              {entry.details && (
                <p className="whitespace-pre-line break-words border-t border-black/[.06] pt-1.5 text-sm text-zinc-600 dark:border-white/[.08] dark:text-zinc-300">
                  <LinkedText text={entry.details} />
                </p>
              )}
              {entry.mine && (
                <div className="flex gap-3 text-sm">
                  <button type="button" onClick={() => setEditing(entry.index)} disabled={pending} className="flex items-center gap-1 text-zinc-600 hover:underline dark:text-zinc-300">
                    <Pencil className="h-3.5 w-3.5" aria-hidden /> Editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`Apagar “${entry.text}”?`)) run({ op: "remove", index: entry.index, expectText: entry.text });
                    }}
                    className="flex items-center gap-1 text-red-600 hover:underline dark:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Apagar
                  </button>
                </div>
              )}
            </li>
          ),
        )}
        {entries.length === 0 && <li className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-zinc-500">A lista está vazia. Adicione o primeiro item.</li>}
      </ul>

      <form onSubmit={add} className="flex gap-2">
        <label className="sr-only" htmlFor="novo-item">
          Novo item
        </label>
        <input
          id="novo-item"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          maxLength={300}
          disabled={pending}
          placeholder="Adicionar item…"
          className={fieldClassName}
        />
        <button type="submit" disabled={pending || !newText.trim()} className="bg-brand text-brand-fg shrink-0 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
          Adicionar
        </button>
      </form>
    </div>
  );
}

function EntryForm({
  entry,
  pending,
  onCancel,
  onSave,
}: {
  entry: SharedListEntry;
  pending: boolean;
  onCancel: () => void;
  onSave: (text: string, details: string) => void;
}) {
  const [text, setText] = useState(entry.text);
  const [details, setDetails] = useState(entry.details);
  const canSave = !pending && text.trim() !== "" && (text.trim() !== entry.text.trim() || details.trim() !== entry.details);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSave(text, details);
      }}
      className="flex flex-col gap-2 rounded-xl border border-brand/50 bg-surface p-3 shadow-sm"
    >
      <input aria-label="Nome" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} disabled={pending} className={fieldClassName} />
      <textarea
        aria-label="Detalhes"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={3}
        maxLength={2000}
        disabled={pending}
        placeholder="Detalhes: link, endereço, valores… (um por linha)"
        className={fieldClassName}
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-black/[.04] dark:text-zinc-300 dark:hover:bg-white/[.06]">
          Cancelar
        </button>
        <button type="submit" disabled={!canSave} className="bg-brand text-brand-fg rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50">
          Salvar
        </button>
      </div>
    </form>
  );
}
