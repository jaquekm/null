"use client";

import { useActionState, useState, useTransition } from "react";
import type { Result } from "@/lib/result";
import { deleteTag, mergeTags, renameTag } from "../actions";
import type { TagWithCount } from "../queries";

const COLOR_TOKENS = ["slate", "red", "amber", "emerald", "teal", "sky", "blue", "violet", "rose"];

const initialRenameState: Result<null> = { ok: true, data: null };

export function TagManagementList({ tags: initialTags }: { tags: TagWithCount[] }) {
  const [tags, setTags] = useState(initialTags);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Excluir a tag "#${name}"? Ela será removida de todos os itens.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteTag(id);
      if (result.ok) setTags((current) => current.filter((t) => t.id !== id));
      else setError(result.error);
    });
  }

  function handleMerge(fromId: string) {
    if (!mergeTargetId) return;
    setError(null);
    startTransition(async () => {
      const result = await mergeTags(fromId, mergeTargetId);
      if (result.ok) {
        setTags((current) => current.filter((t) => t.id !== fromId));
        setMergingId(null);
        setMergeTargetId("");
      } else {
        setError(result.error);
      }
    });
  }

  if (tags.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhuma tag ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-1.5">
        {tags.map((tag) => (
          <li key={tag.id} className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
            {editingId === tag.id ? (
              <TagRenameForm
                tag={tag}
                onDone={(next) => {
                  setTags((current) => current.map((t) => (t.id === tag.id ? { ...t, ...next } : t)));
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-black dark:text-zinc-50">
                  #{tag.name}{" "}
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    ({tag.itemCount} {tag.itemCount === 1 ? "item" : "itens"})
                  </span>
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingId(tag.id)}
                    className="text-xs text-zinc-600 hover:underline dark:text-zinc-300"
                  >
                    Renomear
                  </button>
                  <button
                    type="button"
                    onClick={() => setMergingId(mergingId === tag.id ? null : tag.id)}
                    className="text-xs text-zinc-600 hover:underline dark:text-zinc-300"
                  >
                    Mesclar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(tag.id, tag.name)}
                    disabled={pending}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )}

            {mergingId === tag.id && (
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  aria-label="Mesclar com"
                  className="rounded-lg border border-black/[.12] bg-transparent px-2 py-1 text-xs dark:border-white/[.16]"
                >
                  <option value="">Mesclar com...</option>
                  {tags
                    .filter((t) => t.id !== tag.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={pending || !mergeTargetId}
                  onClick={() => handleMerge(tag.id)}
                  className="text-xs text-zinc-600 hover:underline disabled:opacity-60 dark:text-zinc-300"
                >
                  Confirmar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TagRenameForm({
  tag,
  onDone,
  onCancel,
}: {
  tag: TagWithCount;
  onDone: (next: { name: string; color: string | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color ?? "");
  const action = renameTag.bind(null, tag.id);
  const [state, formAction, pending] = useActionState(action, initialRenameState);

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.ok) onDone({ name: name.toLowerCase(), color: color || null });
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={50}
        className="rounded-lg border border-black/[.12] bg-transparent px-2 py-1 text-sm dark:border-white/[.16]"
      />
      <select
        name="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="rounded-lg border border-black/[.12] bg-transparent px-2 py-1 text-sm dark:border-white/[.16]"
      >
        <option value="">sem cor</option>
        {COLOR_TOKENS.map((token) => (
          <option key={token} value={token}>
            {token}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Salvar"}
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-zinc-500 hover:underline dark:text-zinc-400">
        Cancelar
      </button>
      {!state.ok && (
        <p role="alert" className="w-full text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
