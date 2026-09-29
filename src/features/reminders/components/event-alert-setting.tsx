"use client";

import { AlarmClock } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setEventAlert } from "../actions";
import { EVENT_ALERT_CHANNEL_LABELS, EVENT_ALERT_CHANNELS, EVENT_ALERT_MINUTES, eventAlertLabel, type EventAlertChannel } from "../lib/event-alert";

const selectClassName =
  "rounded-lg border border-black/[.08] bg-surface-muted px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-60 dark:border-white/[.08]";

/** "Me avisar antes de cada evento" (9.4) — na Agenda; salva ao escolher. */
export function EventAlertSetting({ initialMinutes, initialChannel }: { initialMinutes: number | null; initialChannel: EventAlertChannel }) {
  const [minutes, setMinutes] = useState<number | null>(initialMinutes);
  const [channel, setChannel] = useState<EventAlertChannel>(initialChannel);
  const [pending, startTransition] = useTransition();

  function save(nextMinutes: number | null, nextChannel: EventAlertChannel) {
    const previous = { minutes, channel };
    setMinutes(nextMinutes);
    setChannel(nextChannel);
    startTransition(async () => {
      const result = await setEventAlert({ minutesBefore: nextMinutes, channel: nextChannel });
      if (!result.ok) {
        setMinutes(previous.minutes);
        setChannel(previous.channel);
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.label ? `Pronto — aviso ${result.data.label} de cada evento, por ${EVENT_ALERT_CHANNEL_LABELS[nextChannel]}.` : "Aviso antes dos eventos desligado.",
      );
    });
  }

  // Um tempo fora da lista (regra criada à mão em /lembretes/regras) continua aparecendo.
  const options: number[] = minutes !== null && !(EVENT_ALERT_MINUTES as readonly number[]).includes(minutes) ? [...EVENT_ALERT_MINUTES, minutes] : [...EVENT_ALERT_MINUTES];

  return (
    <section
      aria-label="Aviso antes dos eventos"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-black/[.06] bg-surface px-4 py-3 text-sm shadow-sm dark:border-white/[.06]"
    >
      <span className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-200">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand-text">
          <AlarmClock className="h-4 w-4" aria-hidden />
        </span>
        Me avisar antes de cada evento
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <select
          value={minutes ?? ""}
          onChange={(e) => save(e.target.value ? Number(e.target.value) : null, channel)}
          disabled={pending}
          aria-label="Quanto tempo antes"
          className={selectClassName}
        >
          <option value="">Não avisar</option>
          {options.map((value) => (
            <option key={value} value={value}>
              {eventAlertLabel(value)}
            </option>
          ))}
        </select>
        {minutes !== null && (
          <>
            <span className="text-zinc-500 dark:text-zinc-400">por</span>
            <select
              value={channel}
              onChange={(e) => save(minutes, e.target.value as EventAlertChannel)}
              disabled={pending}
              aria-label="Canal do aviso"
              className={selectClassName}
            >
              {EVENT_ALERT_CHANNELS.map((value) => (
                <option key={value} value={value}>
                  {EVENT_ALERT_CHANNEL_LABELS[value]}
                </option>
              ))}
            </select>
          </>
        )}
      </span>
    </section>
  );
}
