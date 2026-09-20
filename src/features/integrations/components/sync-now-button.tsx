"use client";

import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { syncNow } from "../actions";

export function SyncNowButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await syncNow();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Sincronização iniciada — pode levar alguns instantes.");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-md border border-black/[.08] px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.08] dark:text-zinc-50 dark:hover:bg-white/[.06]"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Sincronizando…" : "Sincronizar agora"}
    </button>
  );
}
