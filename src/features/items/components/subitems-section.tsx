"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { Result } from "@/lib/result";
import { createSubitem } from "../actions";
import type { SubitemRow } from "../queries";

const initialState: Result<null> = { ok: true, data: null };

export function SubitemsSection({
  parentId,
  spaceId,
  subitems,
}: {
  parentId: string;
  spaceId: string | null;
  subitems: SubitemRow[];
}) {
  const [adding, setAdding] = useState(false);
  const [state, formAction, pending] = useActionState(createSubitem, initialState);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">Subitens</h2>

      {subitems.length > 0 && (
        <ul className="flex flex-col gap-1">
          {subitems.map((subitem) => (
            <li key={subitem.id}>
              <Link
                href={`/itens/${subitem.id}`}
                className="block rounded-lg px-2 py-1.5 text-sm text-black transition-colors hover:bg-black/[.04] dark:text-zinc-50 dark:hover:bg-white/[.06]"
              >
                {subitem.title || "Sem título"}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="parentId" value={parentId} />
          <input type="hidden" name="spaceId" value={spaceId ?? ""} />
          <input
            name="title"
            placeholder="Título do subitem"
            autoFocus
            maxLength={200}
            className="min-w-0 flex-1 rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20"
          />
          <button
            type="submit"
            disabled={pending}
            className="bg-foreground text-background rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Criando..." : "Criar"}
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
          >
            Cancelar
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-fit items-center gap-1.5 text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          <Plus className="h-4 w-4" />
          Adicionar subitem
        </button>
      )}

      {!state.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </section>
  );
}
