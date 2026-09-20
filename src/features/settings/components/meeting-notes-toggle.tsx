"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setMeetingNotesSettings } from "../actions";

export function MeetingNotesToggle({ initialEnabled, initialMinutesBefore }: { initialEnabled: boolean; initialMinutesBefore: number }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [minutesBefore, setMinutesBefore] = useState(initialMinutesBefore);
  const [pending, startTransition] = useTransition();

  function save(nextEnabled: boolean, nextMinutes: number) {
    startTransition(async () => {
      const result = await setMeetingNotesSettings(nextEnabled, nextMinutes);
      if (!result.ok) {
        setEnabled(enabled);
        setMinutesBefore(minutesBefore);
        toast.error(result.error);
      }
    });
  }

  function handleToggle(checked: boolean) {
    setEnabled(checked);
    save(checked, minutesBefore);
  }

  function handleMinutesBlur() {
    save(enabled, minutesBefore);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.08]">
      <label className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Criar notas de reunião automaticamente</p>
          <p className="text-zinc-500 dark:text-zinc-400">
            Antes de um evento com convidados, cria a nota (tipo Reunião) sozinho — o botão &quot;Criar nota da reunião&quot; continua
            disponível pra criar na hora.
          </p>
        </div>
        <input type="checkbox" checked={enabled} disabled={pending} onChange={(e) => handleToggle(e.target.checked)} aria-label="Criar notas de reunião automaticamente" className="shrink-0" />
      </label>
      {enabled && (
        <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          Minutos antes do evento
          <input
            type="number"
            min={1}
            value={minutesBefore}
            disabled={pending}
            onChange={(e) => setMinutesBefore(Number(e.target.value))}
            onBlur={handleMinutesBlur}
            className="w-16 rounded-md border border-black/[.12] bg-transparent px-2 py-1 dark:border-white/[.16]"
          />
        </label>
      )}
    </div>
  );
}
