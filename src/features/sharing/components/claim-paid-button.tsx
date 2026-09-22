"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { claimSharePayment } from "../actions-public";

/**
 * Botão "Já paguei" (permissão `settle`, 4.10) — só avisa o dono, não
 * quita nada sozinho (o dono confirma ao ver o dinheiro na conta).
 */
export function ClaimPaidButton({ token, initiallyClaimed }: { token: string; initiallyClaimed: boolean }) {
  const [claimed, setClaimed] = useState(initiallyClaimed);
  const [pending, startTransition] = useTransition();

  if (claimed) {
    return (
      <p className="rounded-lg border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
        Você marcou que já pagou. Quem compartilhou vai confirmar ao ver o valor na conta.
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await claimSharePayment(token);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          setClaimed(true);
        });
      }}
      className="bg-foreground text-background self-center rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
    >
      {pending ? "Marcando..." : "Já paguei"}
    </button>
  );
}
