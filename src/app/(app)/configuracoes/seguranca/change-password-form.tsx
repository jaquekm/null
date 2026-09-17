"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Result } from "@/lib/result";
import { changePassword } from "./actions";

const initialState: Result<null> = { ok: true, data: null };

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePassword,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.ok) {
      toast.success("Senha alterada.");
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
          Senha
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Pelo menos 8 caracteres.
        </p>
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="flex max-w-sm flex-col gap-3"
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-sm font-medium text-black dark:text-zinc-50"
          >
            Nova senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClassName}
          />
          {!state.ok && state.fieldErrors?.password && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-black dark:text-zinc-50"
          >
            Confirmar nova senha
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClassName}
          />
          {!state.ok && state.fieldErrors?.confirmPassword && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {state.fieldErrors.confirmPassword[0]}
            </p>
          )}
        </div>

        {!state.ok && !state.fieldErrors && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 self-start rounded-full bg-black/[.06] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-black/[.1] disabled:opacity-60 dark:bg-white/[.08] dark:text-zinc-50 dark:hover:bg-white/[.14]"
        >
          {pending ? "Salvando..." : "Trocar senha"}
        </button>
      </form>
    </section>
  );
}
