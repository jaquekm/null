"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { disconnectGoogle } from "../actions";

export function DisconnectButton({ connectionId, googleEmail }: { connectionId: string; googleEmail: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Desconectar ${googleEmail}? Os calendários e eventos importados dele deixam de aparecer no Hub.`)) return;
    startTransition(async () => {
      const result = await disconnectGoogle(connectionId);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="shrink-0 rounded-md border border-black/[.08] px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-white/[.08] dark:text-red-400 dark:hover:bg-red-950/40"
    >
      {pending ? "Desconectando…" : "Desconectar"}
    </button>
  );
}
