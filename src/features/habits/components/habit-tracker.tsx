"use client";

import { useState, useTransition } from "react";
import { toggleHabitLog } from "../actions";
import { countLoggedInRange, isHabitLogged, type HabitLog } from "../lib/habit-log";

const DAYS_SHOWN = 14;

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastNDays(n: number): string[] {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (n - 1 - i));
    return toDateStr(date);
  });
}

/** Registro diário do Hábito (5.12) — grade dos últimos 14 dias, toque pra marcar/desmarcar. */
export function HabitTracker({ itemId, initialLog, targetPerPeriod }: { itemId: string; initialLog: HabitLog; targetPerPeriod: number | null }) {
  const [log, setLog] = useState(initialLog);
  const [pending, startTransition] = useTransition();

  // `useState` com inicializador preguiçoso: `new Date()` roda uma vez, no mount — não em toda renderização
  // (mesmo padrão já usado em `mark-bill-paid-dialog.tsx`; o linter de pureza do React Compiler rejeita
  // `Date.now()`/`new Date()` direto no corpo do componente, ver PROGRESSO.md 5.7).
  const [{ days, today, weekAgo }] = useState(() => {
    const now = new Date();
    return { days: lastNDays(DAYS_SHOWN), today: toDateStr(now), weekAgo: toDateStr(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)) };
  });
  const loggedThisWeek = countLoggedInRange(log, weekAgo, today);

  function handleToggle(dateStr: string) {
    setLog((current) => ({ ...current, [dateStr]: !isHabitLogged(current, dateStr) }));
    startTransition(async () => {
      await toggleHabitLog(itemId, dateStr);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {days.map((dateStr) => {
          const done = isHabitLogged(log, dateStr);
          return (
            <button
              key={dateStr}
              type="button"
              disabled={pending}
              onClick={() => handleToggle(dateStr)}
              title={dateStr}
              aria-label={`${dateStr}${done ? " (feito)" : ""}`}
              className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors disabled:opacity-60 ${
                done ? "bg-emerald-500 text-white" : "bg-black/[.06] text-zinc-400 dark:bg-white/[.08] dark:text-zinc-500"
              }`}
            >
              {Number(dateStr.slice(8, 10))}
            </button>
          );
        })}
      </div>
      {targetPerPeriod !== null && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {loggedThisWeek}/{targetPerPeriod} esta semana
        </p>
      )}
    </div>
  );
}
