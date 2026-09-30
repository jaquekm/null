"use client";

import { CloudOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { createReminderFromPhrase } from "@/features/reminders/actions";
import { useOnline } from "@/lib/use-online";
import { capture } from "../actions";
import { listQueuedCaptures, removeQueuedCapture } from "../lib/offline-capture-db";
import { flushOfflineCaptures, flushSummary } from "../lib/offline-captures";

/**
 * Celular sem internet (9.9), no layout do app:
 * - faixa "Sem internet" enquanto estiver offline (as páginas já abertas vêm
 *   do cache do aparelho — `public/sw.js`);
 * - quando a conexão volta (e ao abrir o app), envia as capturas guardadas.
 */
export function OfflineSync() {
  const online = useOnline();
  const router = useRouter();
  const flushing = useRef(false);

  useEffect(() => {
    if (!online || flushing.current || typeof indexedDB === "undefined") return;
    flushing.current = true;
    flushOfflineCaptures({
      list: listQueuedCaptures,
      remove: removeQueuedCapture,
      capture: async (text, spaceId, typeId) => capture(text, spaceId, typeId),
      createReminder: async (input) => createReminderFromPhrase(input),
    })
      .then((result) => {
        const summary = flushSummary(result);
        if (summary) {
          toast.success(summary);
          router.refresh();
        }
      })
      .catch(() => {})
      .finally(() => {
        flushing.current = false;
      });
  }, [online, router]);

  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-1.5 text-center text-xs font-medium text-amber-900 dark:text-amber-200">
      <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Sem internet — mostrando o que já foi aberto. Capturas ficam guardadas e vão quando a conexão voltar.
    </div>
  );
}
