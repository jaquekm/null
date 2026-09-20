"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmOptOut } from "../actions-public";

/** Confirmação de opt-out público (3.11) — um clique, sem voltar atrás automaticamente. */
export function OptOutConfirmForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmOptOut(token);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Pronto. Você não vai mais receber mensagens.</p>;
  }

  return (
    <button
      type="button"
      onClick={handleConfirm}
      disabled={pending}
      className="bg-foreground text-background rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
    >
      {pending ? "Confirmando..." : "Confirmar saída"}
    </button>
  );
}
