"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addWater, setWaterGoal } from "../actions";
import { waterProgressPercent, weekdayLetter, type WaterDayTotal } from "../lib/water-progress";

const ADD_ML = 250;

/** Card "Água" do Hoje (10.4): meta editável, "+250 ml" e histórico da semana em barrinhas. */
export function WaterCard({ goalMl: initialGoalMl, todayMl: initialTodayMl, history: initialHistory }: { goalMl: number; todayMl: number; history: WaterDayTotal[] }) {
  const [goalMl, setGoalMl] = useState(initialGoalMl);
  const [todayMl, setTodayMl] = useState(initialTodayMl);
  const [history, setHistory] = useState(initialHistory);
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    const previousTodayMl = todayMl;
    const nextTodayMl = todayMl + ADD_ML;
    setTodayMl(nextTodayMl);
    setHistory((current) => current.map((entry, index) => (index === current.length - 1 ? { ...entry, totalMl: nextTodayMl } : entry)));

    startTransition(async () => {
      const result = await addWater({ amountMl: ADD_ML });
      if (!result.ok) {
        setTodayMl(previousTodayMl);
        setHistory((current) => current.map((entry, index) => (index === current.length - 1 ? { ...entry, totalMl: previousTodayMl } : entry)));
        toast.error(result.error);
        return;
      }
      setTodayMl(result.data.totalMl);
    });
  }

  function handleEditGoal() {
    const input = window.prompt("Meta diária de água (em ml)", String(goalMl));
    if (input == null) return;
    const parsedGoal = Number(input);
    if (!Number.isFinite(parsedGoal) || parsedGoal <= 0) {
      toast.error("Meta inválida.");
      return;
    }
    const previousGoalMl = goalMl;
    setGoalMl(parsedGoal);
    startTransition(async () => {
      const result = await setWaterGoal({ goalMl: parsedGoal });
      if (!result.ok) {
        setGoalMl(previousGoalMl);
        toast.error(result.error);
      }
    });
  }

  const percent = waterProgressPercent(todayMl, goalMl);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-semibold text-black dark:text-zinc-50">{todayMl} ml</span>
        <button type="button" onClick={handleEditGoal} className="text-xs text-zinc-500 hover:underline dark:text-zinc-400">
          Meta: {goalMl} ml
        </button>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.1]">
        <div className="h-full rounded-full bg-sky-500" style={{ width: `${percent}%` }} />
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={pending}
        className="self-start rounded-full bg-sky-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        + {ADD_ML} ml
      </button>

      <div className="flex justify-between gap-1 pt-1">
        {history.map((entry) => {
          const dayPercent = waterProgressPercent(entry.totalMl, goalMl);
          return (
            <div key={entry.day} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-10 w-full items-end overflow-hidden rounded bg-black/[.04] dark:bg-white/[.06]">
                <div className="w-full rounded bg-sky-400/70" style={{ height: `${dayPercent}%` }} />
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{weekdayLetter(entry.day)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
