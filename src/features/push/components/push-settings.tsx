"use client";

import { Bell, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { publicEnv } from "@/lib/env";
import { useMounted } from "@/lib/use-mounted";
import { removePushSubscription, subscribeToPush } from "../actions";
import type { PushSubscriptionRow } from "../queries";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

/** "Ativar notificações neste dispositivo" + lista de dispositivos (3.9). */
export function PushSettings({ initialSubscriptions }: { initialSubscriptions: PushSubscriptionRow[] }) {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const mounted = useMounted();
  const supported = mounted && "serviceWorker" in navigator && "PushManager" in window;
  const [pending, startTransition] = useTransition();

  function activate() {
    if (!publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      toast.error("Notificações push ainda não configuradas (chaves VAPID ausentes nas variáveis de ambiente).");
      return;
    }

    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        });

        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          toast.error("O navegador devolveu uma assinatura incompleta.");
          return;
        }

        const result = await subscribeToPush({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }, navigator.userAgent);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Notificações ativadas neste dispositivo.");
        setSubscriptions((prev) => [
          { id: result.data.id, userAgent: navigator.userAgent, createdAt: new Date().toISOString(), lastUsedAt: null },
          ...prev.filter((s) => s.id !== result.data.id),
        ]);
      } catch {
        toast.error("Não foi possível ativar as notificações — verifique a permissão do navegador.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removePushSubscription(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Notificações push</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            No iOS, só funciona com o Hub instalado na tela inicial (PWA). No dispositivo, o navegador vai pedir permissão.
          </p>
        </div>
        <button
          type="button"
          onClick={activate}
          disabled={pending || !supported}
          className="bg-foreground text-background flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          <Bell className="h-4 w-4" /> Ativar neste dispositivo
        </button>
      </div>

      {!supported && <p className="text-xs text-amber-600 dark:text-amber-400">Este navegador não tem suporte a notificações push.</p>}

      {subscriptions.length > 0 && (
        <ul className="flex flex-col gap-1">
          {subscriptions.map((subscription) => (
            <li
              key={subscription.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]"
            >
              <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">{subscription.userAgent ?? "Dispositivo"}</span>
              <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{formatDate(subscription.createdAt)}</span>
              <button type="button" onClick={() => remove(subscription.id)} disabled={pending} aria-label="Remover dispositivo" className="shrink-0 text-zinc-400 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
