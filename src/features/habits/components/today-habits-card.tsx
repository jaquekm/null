"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleHabitLog } from "../actions";

export interface TodayHabit {
  id: string;
  title: string;
  done: boolean;
}

/** Card "Hábitos" do Hoje (10.8): só os agendados pra hoje, marcáveis sem abrir a Rotina. */
export function TodayHabitsCard({ habits: initialHabits, today }: { habits: TodayHabit[]; today: string }) {
  const [habits, setHabits] = useState(initialHabits);
  const [pending, startTransition] = useTransition();

  function handleToggle(id: string) {
    setHabits((current) => current.map((h) => (h.id === id ? { ...h, done: !h.done } : h)));
    startTransition(async () => {
      const result = await toggleHabitLog(id, today);
      if (!result.ok) {
        setHabits((current) => current.map((h) => (h.id === id ? { ...h, done: !h.done } : h)));
        toast.error(result.error);
        return;
      }
      setHabits((current) => current.map((h) => (h.id === id ? { ...h, done: result.data.logged } : h)));
    });
  }

  if (habits.length === 0) {
    return <p className="rounded-xl bg-surface-muted px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">Nenhum hábito pra hoje.</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {habits.map((habit) => (
        <li key={habit.id}>
          <button
            type="button"
            disabled={pending}
            aria-pressed={habit.done}
            onClick={() => handleToggle(habit.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-60 ${
              habit.done ? "text-zinc-400 line-through dark:text-zinc-500" : "text-black hover:bg-black/[.03] dark:text-zinc-100 dark:hover:bg-white/[.04]"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                habit.done ? "border-brand bg-brand text-brand-fg" : "border-black/[.2] dark:border-white/[.25]"
              }`}
              aria-hidden
            >
              {habit.done ? "✓" : ""}
            </span>
            {habit.title}
          </button>
        </li>
      ))}
    </ul>
  );
}
