"use client";

import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createHabit, deleteHabit, setHabitDays, toggleHabitLog } from "../actions";
import { isHabitLogged } from "../lib/habit-log";
import {
  dayCompletion,
  describeFrequency,
  habitStreak,
  isScheduled,
  scheduledWeekdays,
  startOfWeek,
  weekDates,
  weekdayOf,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  WEEKDAYS,
  type HabitForWeek,
  type Weekday,
} from "../lib/habit-week";
import { addDaysToDateString } from "@/lib/dates";
import { ConsistencyCard } from "./consistency-card";
import { DayChips } from "./day-chips";

function formatDay(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function weekLink(monday: string, currentMonday: string): string {
  return monday === currentMonday ? "/rotina" : `/rotina?semana=${monday}`;
}

/**
 * Rotina (10.1): grade da semana (dias nas linhas, hábitos nas colunas), "+ Hábito"
 * e consistência. O toque marca na hora e salva em segundo plano; se falhar, volta.
 */
export function RotinaWorkspace({ habits: serverHabits, today, weekStart }: { habits: HabitForWeek[]; today: string; weekStart: string }) {
  // Marcações feitas aqui por cima do que veio do servidor — quando a página recarrega, o servidor já tem o mesmo valor.
  const [overrides, setOverrides] = useState<Record<string, Record<string, boolean>>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const habits = serverHabits
    .filter((habit) => !deletedIds.has(habit.id))
    .map((habit) => (overrides[habit.id] ? { ...habit, log: { ...habit.log, ...overrides[habit.id] } } : habit));
  const dates = weekDates(weekStart);
  const currentMonday = startOfWeek(today);
  const isCurrentWeek = weekStart === currentMonday;

  function setOverride(habitId: string, date: string, value: boolean | null) {
    setOverrides((current) => {
      const forHabit = { ...(current[habitId] ?? {}) };
      if (value === null) delete forHabit[date];
      else forHabit[date] = value;
      return { ...current, [habitId]: forHabit };
    });
  }

  async function toggle(habit: HabitForWeek, date: string) {
    const next = !isHabitLogged(habit.log, date);
    setOverride(habit.id, date, next);
    const result = await toggleHabitLog(habit.id, date);
    if (!result.ok) {
      setOverride(habit.id, date, null);
      toast.error(result.error);
    }
  }

  const editingHabit = habits.find((h) => h.id === editing) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-black/[.06] bg-surface p-4 shadow-sm sm:p-5 dark:border-white/[.06]">
        <header className="flex items-center justify-between gap-2">
          <Link
            href={weekLink(addDaysToDateString(weekStart, -7), currentMonday)}
            className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-black/[.05] dark:text-zinc-300 dark:hover:bg-white/[.06]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> Anterior
          </Link>
          <h2 className="text-center text-sm font-semibold text-black dark:text-zinc-50">
            {isCurrentWeek ? "Esta semana" : `Semana de ${formatDay(dates[0]!)} a ${formatDay(dates[6]!)}`}
          </h2>
          {isCurrentWeek ? (
            <span className="w-[5.5rem]" aria-hidden />
          ) : (
            <Link
              href={weekLink(addDaysToDateString(weekStart, 7), currentMonday)}
              className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-black/[.05] dark:text-zinc-300 dark:hover:bg-white/[.06]"
            >
              Próxima <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </header>

        {habits.length === 0 ? (
          <p className="rounded-xl bg-surface-muted px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum hábito ainda. Crie o primeiro aqui embaixo — por exemplo &quot;Beber 2 L de água&quot; todo dia ou &quot;Academia&quot; seg, qua e sex.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
            <table className="w-full border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-surface text-left text-xs font-medium text-zinc-500">
                    <span className="sr-only">Dia</span>
                  </th>
                  {habits.map((habit) => {
                    const streak = habitStreak(habit, today);
                    return (
                      <th key={habit.id} scope="col" className="min-w-[3.5rem] align-bottom font-normal sm:min-w-[4.5rem]">
                        <button
                          type="button"
                          onClick={() => setEditing(editing === habit.id ? null : habit.id)}
                          aria-expanded={editing === habit.id}
                          aria-label={`${habit.title}: mudar os dias (${describeFrequency(habit.frequency)})`}
                          title={`${habit.title} — ${describeFrequency(habit.frequency)}. Toque para mudar os dias.`}
                          className="flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-1 hover:bg-black/[.04] dark:hover:bg-white/[.05]"
                        >
                          <span className="line-clamp-2 text-center text-xs font-semibold text-black dark:text-zinc-100">{habit.title}</span>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{streak > 0 ? `🔥 ${streak}` : describeFrequency(habit.frequency)}</span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {dates.map((date) => {
                  const isToday = date === today;
                  const future = date > today;
                  const { done, scheduled } = dayCompletion(habits, date);
                  return (
                    <tr key={date}>
                      <th scope="row" className={`sticky left-0 z-10 rounded-lg px-1.5 py-1 text-left sm:px-2 font-normal ${isToday ? "bg-brand-soft" : "bg-surface"}`}>
                        <span className={`block text-sm ${isToday ? "font-semibold text-brand-text" : "text-zinc-700 dark:text-zinc-200"}`}>
                          <span className="sm:hidden">{WEEKDAY_SHORT[weekdayOf(date)]}</span>
                          <span className="hidden sm:inline">{WEEKDAY_LONG[weekdayOf(date)]}</span>
                        </span>
                        <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                          {formatDay(date)}
                          {!future && scheduled > 0 && (
                            <span className="block sm:inline">
                              <span className="hidden sm:inline"> · </span>
                              {done}/{scheduled}
                            </span>
                          )}
                        </span>
                      </th>
                      {habits.map((habit) => {
                        const logged = isHabitLogged(habit.log, date);
                        const planned = isScheduled(habit, date);
                        return (
                          <td key={habit.id} className="p-0 text-center">
                            <button
                              type="button"
                              disabled={future}
                              onClick={() => toggle(habit, date)}
                              aria-pressed={logged}
                              aria-label={`${habit.title}, ${WEEKDAY_LONG[weekdayOf(date)]} ${formatDay(date)}${logged ? ", feito" : ""}`}
                              className={`flex h-10 w-full items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed ${
                                logged
                                  ? "bg-emerald-500 text-white"
                                  : planned && !future
                                    ? "bg-black/[.06] hover:bg-black/[.1] dark:bg-white/[.08] dark:hover:bg-white/[.12]"
                                    : "border border-dashed border-black/[.1] opacity-60 dark:border-white/[.12]"
                              }`}
                            >
                              {logged && <Check className="h-5 w-5" aria-hidden />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {habits.length > 0 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Toque no quadrado pra marcar. Tracejado = fora dos dias do hábito (dá pra marcar mesmo assim). Toque no nome pra mudar os dias.
          </p>
        )}

        {editingHabit && (
          <HabitDaysEditor
            key={editingHabit.id}
            habit={editingHabit}
            onClose={() => setEditing(null)}
            onDeleted={() => {
              setDeletedIds((current) => new Set(current).add(editingHabit.id));
              setEditing(null);
            }}
          />
        )}
      </section>

      <NewHabitForm />

      {habits.length > 0 && <ConsistencyCard habits={habits} today={today} />}
    </div>
  );
}

function initialDays(frequency: unknown): Weekday[] {
  const days = scheduledWeekdays(frequency);
  return days ? WEEKDAYS.filter((d) => days.has(d)) : [];
}

function HabitDaysEditor({ habit, onClose, onDeleted }: { habit: HabitForWeek; onClose: () => void; onDeleted: () => void }) {
  const [days, setDays] = useState<Weekday[]>(() => initialDays(habit.frequency));
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await setHabitDays(habit.id, days);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Dias salvos.");
      onClose();
    });
  }

  function handleDelete() {
    if (!window.confirm(`Excluir o hábito "${habit.title}"? O histórico de dias marcados vai pra lixeira junto.`)) return;
    startDeleteTransition(async () => {
      const result = await deleteHabit(habit.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Hábito excluído.");
      onDeleted();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-muted p-3">
      <p className="text-sm font-medium text-black dark:text-zinc-100">Dias de &quot;{habit.title}&quot;</p>
      <DayChips value={days} onChange={setDays} disabled={pending} />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{days.length === 0 ? "Nenhum dia marcado = todo dia." : describeFrequency(`BYDAY=${days.join(",")}`)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={pending} className="bg-brand text-brand-fg rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-60">
          Salvar
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]">
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg border border-red-200 px-4 py-1.5 text-sm text-red-600 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
        >
          Excluir hábito
        </button>
        <Link href={`/itens/${habit.id}`} className="ml-auto text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          Abrir o hábito →
        </Link>
      </div>
    </div>
  );
}

function NewHabitForm() {
  const [title, setTitle] = useState("");
  const [days, setDays] = useState<Weekday[]>([]);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await createHabit({ title, days });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTitle("");
      setDays([]);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-black/[.06] bg-surface p-4 shadow-sm sm:p-5 dark:border-white/[.06]">
      <label htmlFor="new-habit" className="font-semibold text-black dark:text-zinc-50">
        Novo hábito
      </label>
      <div className="flex gap-2">
        <input
          id="new-habit"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Ler 10 páginas"
          maxLength={120}
          disabled={pending}
          className="min-w-0 flex-1 rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm dark:border-white/[.16]"
        />
        <button type="submit" disabled={pending || !title.trim()} className="bg-brand text-brand-fg flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60">
          <Plus className="h-4 w-4" aria-hidden /> Adicionar
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <DayChips value={days} onChange={setDays} disabled={pending} />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{days.length === 0 ? "Nenhum dia marcado = todo dia." : describeFrequency(`BYDAY=${days.join(",")}`)}</span>
      </div>
    </form>
  );
}
