"use client";

import { WEEKDAY_LONG, WEEKDAYS, type Weekday } from "../lib/habit-week";

const LETTER: Record<Weekday, string> = { MO: "S", TU: "T", WE: "Q", TH: "Q", FR: "S", SA: "S", SU: "D" };

/** Chips S T Q Q S S D — nenhum marcado = todo dia. */
export function DayChips({ value, onChange, disabled }: { value: Weekday[]; onChange: (days: Weekday[]) => void; disabled?: boolean }) {
  function toggle(day: Weekday) {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : WEEKDAYS.filter((d) => d === day || value.includes(d)));
  }
  return (
    <div className="flex gap-1" role="group" aria-label="Dias da semana">
      {WEEKDAYS.map((day) => {
        const on = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            disabled={disabled}
            onClick={() => toggle(day)}
            aria-pressed={on}
            aria-label={WEEKDAY_LONG[day]}
            title={WEEKDAY_LONG[day]}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors disabled:opacity-60 ${
              on ? "bg-brand text-brand-fg" : "bg-black/[.06] text-zinc-500 hover:bg-black/[.1] dark:bg-white/[.08] dark:text-zinc-400"
            }`}
          >
            {LETTER[day]}
          </button>
        );
      })}
    </div>
  );
}
