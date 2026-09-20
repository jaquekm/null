"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setOwnerNotificationPreferences } from "../actions";
import type { OwnerNotificationPreferences } from "../queries";

const LABELS: Record<keyof OwnerNotificationPreferences, { title: string; description: string }> = {
  remindersPersonal: { title: "Lembretes pessoais", description: "Meus próprios lembretes (\"para mim\") enviados por push." },
  shareComments: { title: "Comentários em links compartilhados", description: "Quando alguém comenta num item que você compartilhou." },
  jobFailures: { title: "Falhas de jobs", description: "Uma tarefa em segundo plano esgotou as tentativas e falhou." },
  googleReconnect: { title: "Reconexão do Google", description: "A conexão com o Google Calendar caiu e precisa reconectar." },
};

/** "Notificações para o dono (configuráveis)" (3.9) — cada tipo de aviso, liga/desliga individualmente. */
export function OwnerNotificationsToggle({ initialPreferences }: { initialPreferences: OwnerNotificationPreferences }) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [pending, startTransition] = useTransition();

  function handleChange(key: keyof OwnerNotificationPreferences, checked: boolean) {
    const next = { ...preferences, [key]: checked };
    setPreferences(next);
    startTransition(async () => {
      const result = await setOwnerNotificationPreferences(next);
      if (!result.ok) {
        setPreferences(preferences);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">Avisos ao dono</h2>
      {(Object.keys(LABELS) as (keyof OwnerNotificationPreferences)[]).map((key) => (
        <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.08]">
          <div>
            <p className="font-medium text-black dark:text-zinc-50">{LABELS[key].title}</p>
            <p className="text-zinc-500 dark:text-zinc-400">{LABELS[key].description}</p>
          </div>
          <input
            type="checkbox"
            checked={preferences[key]}
            disabled={pending}
            onChange={(e) => handleChange(key, e.target.checked)}
            aria-label={LABELS[key].title}
            className="shrink-0"
          />
        </label>
      ))}
    </div>
  );
}
