"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { WEEKDAY_LONG, WEEKDAYS, weekDates, type Weekday } from "@/features/habits/lib/habit-week";
import { addDaysToDateString } from "@/lib/dates";
import { generateShoppingListFromWeek, saveRecipe } from "@/features/recipes/actions";
import { formatIngredient, formatIngredientsText, parseIngredientsText } from "@/features/recipes/lib/ingredients";
import { findRecipeForDish, weekCoverage } from "@/features/recipes/lib/match";
import type { RecipeRow } from "@/features/recipes/queries";
import { copyPlanDay, repeatWeek, setMealPlanCell } from "../actions";
import { MEAL_SLOTS, type MealKey } from "../lib/meal-slots";
import type { WeekPlan } from "../lib/menu-plan";

const inputClassName =
  "w-full rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const RECIPES_DATALIST_ID = "cardapio-receitas";

function formatDay(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/**
 * "+ Ingredientes" de um prato do cardápio: cria (ou completa) a receita com
 * o mesmo nome, ali mesmo — sem precisar ir na página de Receitas.
 */
function IngredientsForm({ dish, recipe, onSaved, onCancel }: { dish: string; recipe: RecipeRow | null; onSaved: (recipe: RecipeRow) => void; onCancel: () => void }) {
  const [text, setText] = useState(recipe ? formatIngredientsText(recipe.ingredients) : "");
  const [servings, setServings] = useState(String(recipe?.servings ?? 2));
  const [pending, startTransition] = useTransition();
  const preview = parseIngredientsText(text);

  function save() {
    if (preview.length === 0) {
      toast.error("Escreva pelo menos um ingrediente.");
      return;
    }
    startTransition(async () => {
      const servingsValue = Number(servings) || 1;
      const result = await saveRecipe({ id: recipe?.id, title: recipe?.title ?? dish, servings: servingsValue, ingredientsText: text });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Ingredientes de “${dish}” salvos.`);
      onSaved({ id: result.data.id, title: recipe?.title ?? dish, servings: servingsValue, ingredients: preview });
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-muted p-3 text-sm sm:col-span-2">
      <p className="font-medium text-black dark:text-zinc-100">Ingredientes de “{dish}”</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        disabled={pending}
        aria-label={`Ingredientes de ${dish}`}
        placeholder={"Um por linha, do jeito que você escreve:\n2 ovos\n200 g arroz\nsal a gosto"}
        className={inputClassName}
      />
      <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        Rende
        <input
          value={servings}
          onChange={(e) => setServings(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          aria-label="Rende quantas porções"
          className={`${inputClassName} w-14`}
        />
        porções
      </label>
      {preview.length > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Vai pra lista de compras assim: {preview.map(formatIngredient).join(" · ")}
        </p>
      )}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Fica salvo como receita: da próxima vez que escrever “{dish}” no cardápio, os ingredientes já vêm junto.</p>
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={pending} className="bg-brand text-brand-fg rounded-lg px-3 py-1.5 font-medium disabled:opacity-60">
          Salvar ingredientes
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className="rounded-lg border border-black/[.12] px-3 py-1.5 dark:border-white/[.16]">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function DaySection({
  day,
  date,
  plan,
  weekStart,
  recipes,
  onChanged,
  onRecipeSaved,
}: {
  day: Weekday;
  date: string;
  plan: WeekPlan;
  weekStart: string;
  recipes: RecipeRow[];
  onChanged: (next: WeekPlan) => void;
  onRecipeSaved: (recipe: RecipeRow) => void;
}) {
  const [copyFrom, setCopyFrom] = useState<Weekday>(WEEKDAYS[0]!);
  const [editingIngredients, setEditingIngredients] = useState<MealKey | null>(null);
  const [pending, startTransition] = useTransition();
  const dayPlan = plan[day] ?? {};

  function handleCellBlur(mealKey: MealKey, text: string) {
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
          <span className="text-zinc-500 dark:text-zinc-400">Copiar de</span>
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
        {MEAL_SLOTS.map((slot) => {
          const dish = (dayPlan[slot.key] ?? "").trim();
          const recipe = dish ? findRecipeForDish(recipes, dish) : null;
          const hasIngredients = Boolean(recipe && recipe.ingredients.length > 0);
          return (
            <div key={slot.key} className="contents">
              <div className="flex flex-col gap-1">
                <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {slot.label}
                  <input
                    key={`${day}-${slot.key}-${dayPlan[slot.key] ?? ""}`}
                    defaultValue={dayPlan[slot.key] ?? ""}
                    onBlur={(e) => handleCellBlur(slot.key, e.target.value)}
                    disabled={pending}
                    list={RECIPES_DATALIST_ID}
                    placeholder="O que vai comer"
                    className={inputClassName}
                  />
                </label>
                {dish &&
                  (hasIngredients ? (
                    <button
                      type="button"
                      onClick={() => setEditingIngredients(editingIngredients === slot.key ? null : slot.key)}
                      className="self-start text-xs text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      ✓ {recipe!.ingredients.length} {recipe!.ingredients.length === 1 ? "ingrediente" : "ingredientes"} — entra na lista de compras
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingIngredients(editingIngredients === slot.key ? null : slot.key)}
                      className="self-start text-xs font-medium text-brand-text hover:underline"
                    >
                      + Ingredientes (pra lista de compras)
                    </button>
                  ))}
              </div>
              {editingIngredients === slot.key && dish && (
                <IngredientsForm
                  dish={dish}
                  recipe={recipe}
                  onCancel={() => setEditingIngredients(null)}
                  onSaved={(saved) => {
                    onRecipeSaved(saved);
                    setEditingIngredients(null);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Cardápio da semana (10.9–10.10): um card por dia, 5 refeições. Cada prato
 * pode ganhar ingredientes ali mesmo (vira receita); "Gerar lista de compras"
 * soma os ingredientes da semana na lista de compras.
 */
export function MenuGrid({ weekStart, plan: initialPlan, recipes: initialRecipes }: { weekStart: string; plan: WeekPlan; recipes: RecipeRow[] }) {
  const [plan, setPlan] = useState(initialPlan);
  const [recipes, setRecipes] = useState(initialRecipes);
  const [lastList, setLastList] = useState<{ id: string; count: number } | null>(null);
  const [repeating, startRepeatTransition] = useTransition();
  const [generating, startGenerateTransition] = useTransition();
  const dates = weekDates(weekStart);
  const nextWeekStart = addDaysToDateString(weekStart, 7);
  const router = useRouter();
  const coverage = weekCoverage(plan, recipes);

  function handleRecipeSaved(saved: RecipeRow) {
    setRecipes((current) => [...current.filter((r) => r.id !== saved.id), saved]);
  }

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
        toast.error("Nenhum prato desta semana tem ingredientes ainda. Toque em “+ Ingredientes” embaixo de um prato.");
        return;
      }
      if (!result.data.shoppingListId) {
        toast.error("Achei os ingredientes, mas não consegui somar na lista de compras. Tente de novo.");
        return;
      }
      setLastList({ id: result.data.shoppingListId, count: result.data.ingredientsAdded });
      toast.success(`Somei ${result.data.ingredientsAdded} ingredientes na lista de compras.`);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <datalist id={RECIPES_DATALIST_ID}>
        {recipes.map((r) => (
          <option key={r.id} value={r.title} />
        ))}
      </datalist>

      <section className="flex flex-col gap-2 rounded-2xl border border-black/[.06] bg-surface p-4 text-sm shadow-sm dark:border-white/[.06]">
        <h2 className="font-semibold text-black dark:text-zinc-50">Como vira lista de compras</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-zinc-600 dark:text-zinc-300">
          <li>Escreva o prato na refeição (ex.: “Frango com arroz”).</li>
          <li>
            Toque em <strong>+ Ingredientes</strong> embaixo dele e escreva um por linha (“2 ovos”, “200 g arroz”). Só precisa fazer uma vez por prato.
          </li>
          <li>
            Toque em <strong>Gerar lista de compras</strong>: os ingredientes da semana somam na sua lista “Compras”.
          </li>
        </ol>
        <div className="mt-1 flex flex-col gap-2 rounded-xl bg-surface-muted p-3">
          <p className="text-zinc-700 dark:text-zinc-200">
            {coverage.dishes === 0
              ? "Nenhum prato escrito nesta semana ainda."
              : `${coverage.withIngredients} de ${coverage.dishes} ${coverage.dishes === 1 ? "prato tem" : "pratos têm"} ingredientes e ${coverage.withIngredients === 1 ? "entra" : "entram"} na lista.`}
          </p>
          {coverage.missing.length > 0 && coverage.dishes > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Sem ingredientes ainda: {coverage.missing.join(", ")}.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={generating || coverage.withIngredients === 0}
              onClick={handleGenerateShoppingList}
              className="bg-brand text-brand-fg rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {generating ? "Somando…" : "Gerar lista de compras desta semana"}
            </button>
            {lastList && (
              <Link href={`/itens/${lastList.id}`} className="text-sm font-medium text-brand-text hover:underline">
                Abrir lista de compras →
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={repeating}
          onClick={handleRepeatWeek}
          className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm disabled:opacity-60 dark:border-white/[.16]"
        >
          Repetir esta semana na próxima
        </button>
        <Link href="/receitas" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          Ver todas as receitas
        </Link>
      </div>

      {WEEKDAYS.map((day, index) => (
        <DaySection
          key={day}
          day={day}
          date={dates[index]!}
          plan={plan}
          weekStart={weekStart}
          recipes={recipes}
          onChanged={setPlan}
          onRecipeSaved={handleRecipeSaved}
        />
      ))}
    </div>
  );
}
