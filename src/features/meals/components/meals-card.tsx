"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleMeal } from "../actions";
import { MEAL_SLOTS, mealsProgress, type MealsState } from "../lib/meal-slots";

/** Card "Refeições" do Hoje (10.8): 4 chips marcáveis — só "comi ou não", sem detalhar o quê (isso é o cardápio, 10.9). */
export function MealsCard({ meals: initialMeals }: { meals: MealsState }) {
  const [meals, setMeals] = useState(initialMeals);
  const [pending, startTransition] = useTransition();
  const { done, total } = mealsProgress(meals);

  function handleToggle(mealKey: (typeof MEAL_SLOTS)[number]["key"]) {
    const previous = meals;
    setMeals((current) => ({ ...current, [mealKey]: !current[mealKey] }));
    startTransition(async () => {
      const result = await toggleMeal({ mealKey });
      if (!result.ok) {
        setMeals(previous);
        toast.error(result.error);
        return;
      }
      setMeals(result.data);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {done} de {total} hoje
      </p>
      <div className="flex flex-wrap gap-2">
        {MEAL_SLOTS.map((slot) => {
          const checked = meals[slot.key] === true;
          return (
            <button
              key={slot.key}
              type="button"
              disabled={pending}
              aria-pressed={checked}
              onClick={() => handleToggle(slot.key)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-60 ${
                checked
                  ? "border-transparent bg-brand text-brand-fg"
                  : "border-black/[.12] text-zinc-600 hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]"
              }`}
            >
              {slot.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
