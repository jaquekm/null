"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { WEEKDAY_LONG, WEEKDAYS, weekDates, type Weekday } from "@/features/habits/lib/habit-week";
import { addDaysToDateString } from "@/lib/dates";
import { generateShoppingListFromWeek } from "@/features/recipes/actions";
import { copyPlanDay, repeatWeek, setMealPlanCell } from "../actions";
import { MEAL_SLOTS } from "../lib/meal-slots";
import type { WeekPlan } from "../lib/menu-plan";

const inputClassName =
  "w-full rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

function formatDay(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function DaySection({
  day,
  date,
  plan,
  weekStart,
  onChanged,
}: {
  day: Weekday;
  date: string;
  plan: WeekPlan;
  weekStart: string;
  onChanged: (next: WeekPlan) => void;
}) {
  const [copyFrom, setCopyFrom] = useState<Weekday>(WEEKDAYS[0]!);
  const [pending, startTransition] = useTransition();
  const dayPlan = plan[day] ?? {};

  function handleCellBlur(mealKey: (typeof MEAL_SLOTS)[number]["key"], text: string) {
    if ((dayPlan[mealKey] ?? "") === text.trim()) return;
    startTransition(async () => {
      const result = await setMealPlanCell({ weekStart, day, mealKey, text });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onChanged(result.data);
    });
  }

  function handleCopy() {
    startTransition(async () => {
      const result = await copyPlanDay({ weekStart, from: copyFrom, to: day });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onChanged(result.data);
      toast.success(`Copiado de ${WEEKDAY_LONG[copyFrom]}.`);
    });
  }

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-black/[.06] bg-surface p-4 shadow-sm dark:border-white/[.06]">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-black dark:text-zinc-50">
          {WEEKDAY_LONG[day]} <span className="font-normal text-zinc-500 dark:text-zinc-400">{formatDay(date)}</span>
        </h3>
        <div className="flex items-center gap-1.5 text-xs">
          <select
            value={copyFrom}
            onChange={(e) => setCopyFrom(e.target.value as Weekday)}
            aria-label={`Copiar pra ${WEEKDAY_LONG[day]} a partir de`}
            className="rounded-lg border border-black/[.12] bg-transparent px-1.5 py-1 dark:border-white/[.16]"
          >
            {WEEKDAYS.filter((d) => d !== day).map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_LONG[d]}
              </option>
            ))}
          </select>
          <button type="button" disabled={pending} onClick={handleCopy} className="text-brand-text hover:underline disabled:opacity-60">
            Copiar
          </button>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MEAL_SLOTS.map((slot) => (
          <label key={slot.key} className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            {slot.label}
            <input
              key={`${day}-${slot.key}-${dayPlan[slot.key] ?? ""}`}
              defaultValue={dayPlan[slot.key] ?? ""}
              onBlur={(e) => handleCellBlur(slot.key, e.target.value)}
              disabled={pending}
              placeholder="O que vai comer"
              className={inputClassName}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

/** Cardápio da semana (10.9): um card por dia, 5 refeições, "Copiar" de outro dia e "Repetir esta semana". */
export function MenuGrid({ weekStart, plan: initialPlan }: { weekStart: string; plan: WeekPlan }) {
  const [plan, setPlan] = useState(initialPlan);
  const [repeating, startRepeatTransition] = useTransition();
  const [generating, startGenerateTransition] = useTransition();
  const dates = weekDates(weekStart);
  const nextWeekStart = addDaysToDateString(weekStart, 7);
  const router = useRouter();

  function handleRepeatWeek() {
    startRepeatTransition(async () => {
      const result = await repeatWeek({ fromWeekStart: weekStart, toWeekStart: nextWeekStart });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Semana repetida na próxima.");
      router.push(`/cardapio?semana=${nextWeekStart}`);
    });
  }

  function handleGenerateShoppingList() {
    startGenerateTransition(async () => {
      const result = await generateShoppingListFromWeek({ weekStart });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data.matchedRecipes.length === 0) {
        toast.error("Nenhuma receita encontrada nas células desta semana.");
        return;
      }
      toast.success(
        result.data.addedToShoppingList
          ? `Somado ${result.data.matchedRecipes.length} receita(s) na lista de compras.`
          : `Achei ${result.data.matchedRecipes.length} receita(s), mas não consegui somar na lista de compras.`,
      );
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={repeating}
          onClick={handleRepeatWeek}
          className="self-start rounded-full border border-black/[.12] px-4 py-1.5 text-sm disabled:opacity-60 dark:border-white/[.16]"
        >
          Repetir esta semana na próxima
        </button>
        <button
          type="button"
          disabled={generating}
          onClick={handleGenerateShoppingList}
          className="self-start rounded-full border border-black/[.12] px-4 py-1.5 text-sm disabled:opacity-60 dark:border-white/[.16]"
        >
          Gerar lista de compras desta semana
        </button>
      </div>
      {WEEKDAYS.map((day, index) => (
        <DaySection key={day} day={day} date={dates[index]!} plan={plan} weekStart={weekStart} onChanged={setPlan} />
      ))}
    </div>
  );
}
