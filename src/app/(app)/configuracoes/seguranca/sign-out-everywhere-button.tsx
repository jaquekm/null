"use client";

import { signOutEverywhere } from "./actions";

export function SignOutEverywhereButton() {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
          Sessões
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Encerra o login em todos os aparelhos, inclusive este.
        </p>
      </div>
      <form action={signOutEverywhere}>
        <button
          type="submit"
          className="self-start rounded-full border border-red-600/40 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-600/10 dark:border-red-400/40 dark:text-red-400 dark:hover:bg-red-400/10"
        >
          Sair de todas as sessões
        </button>
      </form>
    </section>
  );
}
