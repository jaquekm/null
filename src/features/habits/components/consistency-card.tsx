import { consistencyHeatmap, habitStreak, perfectDaysStreak, WEEKDAY_SHORT, WEEKDAYS, type HabitForWeek } from "../lib/habit-week";

const LEVEL_CLASS = [
  "bg-black/[.06] dark:bg-white/[.07]",
  "bg-emerald-200 dark:bg-emerald-900",
  "bg-emerald-300 dark:bg-emerald-700",
  "bg-emerald-400 dark:bg-emerald-600",
  "bg-emerald-500 dark:bg-emerald-400",
];

function formatDay(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function daysLabel(n: number): string {
  return n === 1 ? "1 dia seguido" : `${n} dias seguidos`;
}

/** Consistência (10.1): mapa das últimas 16 semanas, sequência geral e de cada hábito. */
export function ConsistencyCard({ habits, today }: { habits: HabitForWeek[]; today: string }) {
  const map = consistencyHeatmap(habits, today);
  const perfect = perfectDaysStreak(habits, today);
  const streaks = habits.map((habit) => ({ habit, streak: habitStreak(habit, today) })).sort((a, b) => b.streak - a.streak);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-black/[.06] bg-surface p-5 shadow-sm dark:border-white/[.06]">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-black dark:text-zinc-50">Consistência</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          <span aria-hidden>🔥</span> <strong>{daysLabel(perfect)}</strong> com tudo feito
        </p>
      </header>

      <div className="overflow-x-auto">
        <div className="flex gap-[3px]" role="img" aria-label="Mapa de consistência das últimas 16 semanas">
          <div className="mr-1 flex flex-col gap-[3px] text-[10px] leading-3 text-zinc-400">
            {WEEKDAYS.map((day, i) => (
              <span key={day} className="h-3">
                {i % 2 === 0 ? WEEKDAY_SHORT[day] : ""}
              </span>
            ))}
          </div>
          {map.map((week) => (
            <div key={week[0]!.date} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <span
                  key={day.date}
                  title={day.level < 0 ? formatDay(day.date) : `${formatDay(day.date)}: ${day.done} de ${day.scheduled}`}
                  className={`h-3 w-3 rounded-[3px] ${day.level < 0 ? "bg-transparent" : LEVEL_CLASS[day.level]} ${day.date === today ? "ring-1 ring-zinc-500" : ""}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        Menos
        {LEVEL_CLASS.map((cls) => (
          <span key={cls} className={`h-3 w-3 rounded-[3px] ${cls}`} aria-hidden />
        ))}
        Mais
      </div>

      {streaks.length > 0 && (
        <ul className="flex flex-col divide-y divide-black/[.05] text-sm dark:divide-white/[.06]">
          {streaks.map(({ habit, streak }) => (
            <li key={habit.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="truncate text-zinc-700 dark:text-zinc-200">{habit.title}</span>
              <span className={`shrink-0 tabular-nums ${streak > 0 ? "text-zinc-700 dark:text-zinc-200" : "text-zinc-400"}`}>
                {streak > 0 ? `🔥 ${daysLabel(streak)}` : "começa hoje"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
