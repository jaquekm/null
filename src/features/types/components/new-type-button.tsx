"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";
import type { SidebarSpace } from "@/features/spaces/queries";
import type { Result } from "@/lib/result";
import { createObjectType } from "../actions";

const initialState: Result<{ slug: string } | null> = { ok: true, data: null };

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

export function NewTypeButton({ spaces }: { spaces: SidebarSpace[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createObjectType, initialState);

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.ok && state.data && open) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-foreground text-background flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
      >
        <Plus className="h-4 w-4" />
        Novo tipo
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
      <input name="icon" placeholder="🙂" maxLength={4} className={`${inputClassName} w-14 text-center`} />
      <input name="name" placeholder="Nome do tipo" autoFocus required maxLength={80} className={`${inputClassName} min-w-0 flex-1`} />
      <select name="spaceId" aria-label="Espaço" defaultValue="" className={inputClassName}>
        <option value="">Todos os espaços</option>
        {spaces.map((space) => (
          <option key={space.id} value={space.id}>
            {space.icon ? `${space.icon} ` : ""}
            {space.name}
          </option>
        ))}
      </select>
      {!state.ok && <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-foreground text-background rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60">
        {pending ? "Criando..." : "Criar"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
      >
        Cancelar
      </button>
    </form>
  );
}
