"use client";

import { useState, useTransition } from "react";
import { searchItemsForMention, type MentionSearchResult } from "@/features/items/actions";
import { testAutomation, type TestAutomationResult } from "../actions";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

/** "Testar com item…" (5.3): simula contra um item de verdade sem aplicar nada. */
export function TestAutomationPanel({ automationId }: { automationId: string }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<MentionSearchResult[]>([]);
  const [selected, setSelected] = useState<MentionSearchResult | null>(null);
  const [result, setResult] = useState<TestAutomationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    setResult(null);
    startTransition(async () => {
      setOptions(await searchItemsForMention(value));
    });
  }

  function handleTest() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const outcome = await testAutomation(automationId, selected.id);
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      setResult(outcome.data);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
      <h3 className="text-sm font-medium text-black dark:text-zinc-50">Testar com item...</h3>
      <input placeholder="Buscar item pelo título" value={query} onChange={(event) => handleQueryChange(event.target.value)} className={inputClassName} />
      {options.length > 0 && !selected && (
        <ul className="flex flex-col gap-1">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(option);
                  setOptions([]);
                  setQuery(option.title);
                }}
                className="w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06]"
              >
                {option.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={handleTest}
        disabled={!selected || pending}
        className="bg-foreground text-background self-start rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Testando..." : "Testar"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-2 rounded-lg bg-black/[.03] p-3 text-sm dark:bg-white/[.05]">
          <p className={result.conditionsPassed ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
            {result.conditionsPassed ? "As condições passariam." : "As condições NÃO passariam — nenhuma ação rodaria."}
          </p>
          {result.conditionsPassed && (
            <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-200">
              {result.actionDescriptions.map((description, index) => (
                <li key={index}>{description}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
