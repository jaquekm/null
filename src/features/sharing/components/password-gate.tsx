"use client";

import { useState, useTransition } from "react";
import { verifySharePassword } from "../actions-public";

/** Formulário de senha da página pública (3.11) — em caso de sucesso, o cookie já foi gravado; só recarrega a página. */
export function PasswordGate({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifySharePassword(token, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 p-10">
      <h1 className="text-lg font-medium text-black dark:text-zinc-50">Esse link tem senha</h1>
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          autoFocus
          disabled={pending}
          className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20"
        />
        {error && <span className="text-sm text-red-500">{error}</span>}
        <button
          type="submit"
          disabled={pending || !password}
          className="bg-foreground text-background rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Verificando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
