"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteRecipe, saveRecipe } from "../actions";
import { formatIngredient, formatIngredientsText, scaleIngredients } from "../lib/ingredients";
import type { RecipeRow } from "../queries";

const inputClassName =
  "w-full rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

function RecipeCard({ recipe, onChanged, onDeleted }: { recipe: RecipeRow; onChanged: () => void; onDeleted: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [adjustTo, setAdjustTo] = useState<string>("");
  const [title, setTitle] = useState(recipe.title);
  const [servings, setServings] = useState(String(recipe.servings));
  const [ingredientsText, setIngredientsText] = useState(formatIngredientsText(recipe.ingredients));
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();

  const adjustToNumber = Number(adjustTo);
  const showScaled = adjustTo.trim() !== "" && Number.isFinite(adjustToNumber) && adjustToNumber > 0;
  const scaled = showScaled ? scaleIngredients(recipe.ingredients, recipe.servings, adjustToNumber) : recipe.ingredients;

  function handleSave() {
    startTransition(async () => {
      const servingsValue = Number(servings) || 1;
      const result = await saveRecipe({ id: recipe.id, title, servings: servingsValue, ingredientsText });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Receita salva.");
      setEditing(false);
      onChanged();
    });
  }

  function handleDelete() {
    if (!window.confirm(`Excluir a receita "${recipe.title}"?`)) return;
    startDeleteTransition(async () => {
      const result = await deleteRecipe(recipe.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDeleted(recipe.id);
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-surface-muted px-3 py-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClassName} aria-label="Nome da receita" />
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Porções
          <input value={servings} onChange={(e) => setServings(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${inputClassName} w-20`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Ingredientes (um por linha: &quot;2 ovos&quot;, &quot;200 g arroz&quot;, &quot;sal a gosto&quot;)
          <textarea value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)} rows={5} className={inputClassName} />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={handleSave} disabled={pending} className="bg-brand text-brand-fg rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60">
            Salvar
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-muted px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setEditing(true)} className="text-left text-sm font-medium text-black hover:underline dark:text-zinc-100">
          {recipe.title}
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{recipe.servings} porções</span>
      </div>

      {recipe.ingredients.length > 0 && (
        <ul className="text-sm text-zinc-700 dark:text-zinc-300">
          {scaled.map((ingredient, index) => (
            <li key={index}>{formatIngredient(ingredient)}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          Ajustar pra
          <input
            value={adjustTo}
            onChange={(e) => setAdjustTo(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder={String(recipe.servings)}
            className={`${inputClassName} w-14`}
            aria-label={`Ajustar "${recipe.title}" pra quantas pessoas`}
          />
          pessoas
        </label>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="ml-auto text-xs text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
        >
          Excluir
        </button>
      </div>
    </div>
  );
}

/** Receitas (10.10): nome, porções e ingredientes — usadas no cardápio pra somar a lista de compras. */
export function RecipesWorkspace({ recipes: initialRecipes }: { recipes: RecipeRow[] }) {
  const router = useRouter();
  const [recipes, setRecipes] = useState(initialRecipes);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("4");
  const [ingredientsText, setIngredientsText] = useState("");
  const [pending, startTransition] = useTransition();

  function handleDeleted(id: string) {
    setRecipes((current) => current.filter((r) => r.id !== id));
  }

  function handleCreate() {
    if (!title.trim()) {
      toast.error("Dê um nome à receita.");
      return;
    }
    startTransition(async () => {
      const result = await saveRecipe({ title, servings: Number(servings) || 1, ingredientsText });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Receita criada.");
      setTitle("");
      setServings("4");
      setIngredientsText("");
      setAdding(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {recipes.length === 0 ? (
        <p className="rounded-xl bg-surface-muted px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">Nenhuma receita ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onChanged={() => router.refresh()} onDeleted={handleDeleted} />
          ))}
        </div>
      )}

      {adding ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-muted px-3 py-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome (ex.: Frango com arroz)" className={inputClassName} />
          <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            Porções
            <input value={servings} onChange={(e) => setServings(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${inputClassName} w-20`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            Ingredientes (um por linha: &quot;2 ovos&quot;, &quot;200 g arroz&quot;, &quot;sal a gosto&quot;)
            <textarea value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)} rows={5} className={inputClassName} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={handleCreate} disabled={pending} className="bg-brand text-brand-fg rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60">
              Criar
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="self-start text-sm font-medium text-brand-text hover:underline">
          + Nova receita
        </button>
      )}
    </div>
  );
}
