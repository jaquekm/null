"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";
import type { Result } from "@/lib/result";
import { ColorPicker } from "@/components/shared/color-picker";
import { createSpace } from "../actions";

const initialState: Result<{ slug: string } | null> = { ok: true, data: null };

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

export function NewSpaceButton({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createSpace, initialState);

  // Ajusta o estado durante a renderização (não em useEffect) quando a
  // criação tem sucesso, seguindo o padrão de "adjusting state" do React:
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
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
        title={collapsed ? "Novo espaço" : undefined}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-black/[.04] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[.06] dark:hover:text-zinc-50"
      >
        <Plus className="h-4 w-4 shrink-0" />
        {!collapsed && "Novo espaço"}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1.5 px-1 py-1">
      <div className="flex gap-1.5">
        <input name="icon" placeholder="🙂" maxLength={4} className={`${inputClassName} w-11 text-center`} />
        <input
          name="name"
          placeholder="Nome do espaço"
          autoFocus
          maxLength={80}
          className={`${inputClassName} min-w-0 flex-1`}
        />
      </div>
      <ColorPicker name="color" aria-label="Cor do espaço" />
      {!state.ok && <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>}
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={pending}
          className="bg-foreground text-background rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
        >
          {pending ? "Criando..." : "Criar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
