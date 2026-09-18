"use client";

import { useActionState, useState } from "react";
import type { Result } from "@/lib/result";
import { updateItemTitle } from "../actions";

const initialState: Result<{ updatedAt: string } | null> = { ok: true, data: null };

export function TitleEditor({
  itemId,
  initialTitle,
  updatedAt,
  onSaved,
}: {
  itemId: string;
  initialTitle: string;
  updatedAt: string;
  onSaved: (updatedAt: string) => void;
}) {
  const action = updateItemTitle.bind(null, itemId, updatedAt);
  const [state, formAction, pending] = useActionState(action, initialState);

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.ok && state.data) onSaved(state.data.updatedAt);
  }

  const conflict = !state.ok && Boolean(state.fieldErrors?._conflict);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <textarea
        name="title"
        defaultValue={initialTitle}
        placeholder="Sem título"
        rows={1}
        disabled={pending}
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onInput={(e) => {
          e.currentTarget.style.height = "auto";
          e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
        }}
        className="resize-none overflow-hidden border-0 bg-transparent text-xl font-semibold text-black outline-none dark:text-zinc-50"
      />
      <span className="text-xs text-zinc-400 dark:text-zinc-500">{pending ? "Salvando…" : "Salvo"}</span>
      {conflict && (
        <p role="alert" className="text-xs text-amber-600 dark:text-amber-400">
          {state.error}{" "}
          <button type="button" onClick={() => window.location.reload()} className="underline">
            Recarregar
          </button>
        </p>
      )}
    </form>
  );
}
