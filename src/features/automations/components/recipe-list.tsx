"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RECIPE_CATEGORIES, RECIPE_CHANNEL_SHORT, RECIPES, type Recipe, type RecipeChannel, type RecipeKey, type RecipeState } from "../lib/recipes";
import { setRecipeActive } from "../recipe-actions";

function adjustHref(recipe: Recipe, state: RecipeState): string | null {
  if (!state.sourceId) return null;
  if (recipe.engine === "automation") return `/configuracoes/automacoes/${state.sourceId}`;
  if (recipe.engine === "event_alert") return "/agenda";
  return "/lembretes/regras";
}

function RecipeCard({ recipe, initialState, whatsappAvailable }: { recipe: Recipe; initialState: RecipeState; whatsappAvailable: boolean }) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const channel = state.channel;

  function save(next: { active: boolean; channel: RecipeChannel | null }) {
    const previous = state;
    setState({ ...state, ...next });
    startTransition(async () => {
      const result = await setRecipeActive({ key: recipe.key, active: next.active, channel: next.channel });
      if (!result.ok) {
        setState(previous);
        toast.error(result.error);
        return;
      }
      if (next.active !== previous.active) toast.success(next.active ? "Receita ligada." : "Receita desligada.");
      router.refresh();
    });
  }

  function chooseChannel(value: RecipeChannel) {
    if (value === channel) return;
    if (state.active) save({ active: true, channel: value });
    else setState({ ...state, channel: value });
  }

  const href = state.active ? adjustHref(recipe, state) : null;
  const sentenceId = `recipe-${recipe.key}`;

  return (
    <li
      className={`flex flex-col gap-3 rounded-2xl border p-4 transition-colors ${
        state.active ? "border-brand/40 bg-brand-soft" : "border-black/[.06] bg-surface dark:border-white/[.06]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p id={sentenceId} className="text-[15px] leading-snug font-medium text-black dark:text-zinc-50">
            {recipe.sentence(channel, state)}
          </p>
          {recipe.hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{recipe.hint}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.active}
          aria-labelledby={sentenceId}
          disabled={pending}
          onClick={() => save({ active: !state.active, channel })}
          className={`focus-visible:ring-brand/40 relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60 ${
            state.active ? "bg-brand" : "bg-zinc-300 dark:bg-zinc-600"
          }`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${state.active ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      {(recipe.channels.length > 1 || href) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {recipe.channels.length > 1 ? (
            <div role="radiogroup" aria-label="Por onde avisar" className="flex flex-wrap gap-1.5">
              {recipe.channels.map((value) => {
                const blocked = value === "whatsapp" && !whatsappAvailable;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={channel === value}
                    disabled={pending || blocked}
                    title={blocked ? "Cadastre seu WhatsApp em Notificações" : undefined}
                    onClick={() => chooseChannel(value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                      channel === value
                        ? "border-brand bg-brand text-brand-fg"
                        : "border-black/[.1] text-zinc-600 hover:bg-surface-muted dark:border-white/[.12] dark:text-zinc-300"
                    }`}
                  >
                    {RECIPE_CHANNEL_SHORT[value]}
                  </button>
                );
              })}
            </div>
          ) : (
            <span />
          )}
          {href && (
            <Link href={href} className="text-brand-text text-xs font-medium hover:underline">
              Ajustar
            </Link>
          )}
        </div>
      )}
    </li>
  );
}

/** "Receitas prontas" (9.8): frases prontas pra ligar com um toque, por assunto. */
export function RecipeList({ states, ownerWhatsapp }: { states: Record<RecipeKey, RecipeState>; ownerWhatsapp: string | null }) {
  const whatsappAvailable = ownerWhatsapp !== null;
  const needsWhatsapp = !whatsappAvailable;

  return (
    <div className="flex flex-col gap-5">
      {needsWhatsapp && (
        <p className="rounded-xl border border-black/[.06] bg-surface-muted px-3 py-2 text-xs text-zinc-600 dark:border-white/[.06] dark:text-zinc-300">
          Quer receber no WhatsApp?{" "}
          <Link href="/configuracoes/notificacoes" className="text-brand-text font-medium underline">
            Cadastre seu número
          </Link>{" "}
          e a opção aparece aqui.
        </p>
      )}
      {RECIPE_CATEGORIES.map((category) => {
        const recipes = RECIPES.filter((recipe) => recipe.category === category);
        if (recipes.length === 0) return null;
        return (
          <section key={category} aria-label={category} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{category}</h3>
            <ul className="flex flex-col gap-2">
              {recipes.map((recipe) => (
                <RecipeCard key={recipe.key} recipe={recipe} initialState={states[recipe.key]} whatsappAvailable={whatsappAvailable} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
