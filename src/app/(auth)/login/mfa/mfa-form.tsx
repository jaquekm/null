"use client";

import { useActionState } from "react";
import type { Result } from "@/lib/result";
import { verifyMfa } from "./actions";

const initialState: Result<null> = { ok: true, data: null };

export function MfaForm({
  factorId,
  challengeId,
  next,
}: {
  factorId: string;
  challengeId: string;
  next: string;
}) {
  const [state, formAction, pending] = useActionState(verifyMfa, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="challengeId" value={challengeId} />
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="code"
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Código
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          required
          className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-center text-lg tracking-[0.5em] focus:ring-2 focus:ring-black/20 focus:outline-none dark:border-white/[.16] dark:focus:ring-white/20"
        />
      </div>

      {!state.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background mt-2 rounded-full px-5 py-2 text-sm font-medium transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {pending ? "Verificando..." : "Verificar"}
      </button>
    </form>
  );
}
