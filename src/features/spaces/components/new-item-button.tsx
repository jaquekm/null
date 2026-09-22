"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";
import type { Result } from "@/lib/result";
import { createItemInSpace } from "../actions";
import type { SpaceTypeOption } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const initialState: Result<null> = { ok: true, data: null };

export function NewItemButton({
  spaceId,
  types,
  defaultTypeId,
}: {
  spaceId: string;
  types: SpaceTypeOption[];
  /** Tipo da aba atual (`?tipo=`), se houver — sem isto o formulário sempre criava "Sem tipo", então o item não aparecia na aba filtrada de onde o dono clicou "Novo" (parecia ter sumido). */
  defaultTypeId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createItemInSpace, initialState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-foreground text-background flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
      >
        <Plus className="h-4 w-4" />
        Novo
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="spaceId" value={spaceId} />
      <input name="title" placeholder="Título" autoFocus maxLength={200} className={`${inputClassName} min-w-0 flex-1`} />
      <select name="typeId" aria-label="Tipo" defaultValue={defaultTypeId ?? ""} className={inputClassName}>
        <option value="">Sem tipo</option>
        {types.map((type) => (
          <option key={type.id} value={type.id}>
            {type.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Criando..." : "Criar"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
      >
        Cancelar
      </button>
      {!state.ok && (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
