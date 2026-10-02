"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateWeeklyCheckinSummary } from "@/features/ai/actions";
import { formatBRL } from "@/lib/money";
import type { WeeklyCheckinData } from "../queries";

/** "Consistência da semana" (10.16): hábitos, orçamento, treinos, peso e remédios esquecidos, com uma frase de resumo da IA sob demanda. */
export function WeeklyCheckinCard({ data }: { data: WeeklyCheckinData }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateWeeklyCheckinSummary();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSummary(result.data);
    });
  }

  const hasMissedDoses = data.medications.some((m) => m.missedDoses > 0);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
      <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Consistência da semana</h2>

      <ul className="flex flex-col gap-1.5 text-sm text-zinc-700 dark:text-zinc-200">
        {data.habits && (
          <li>
            Hábitos: {data.habits.done} de {data.habits.scheduled} marcações feitas
          </li>
        )}
        <li>Treinos: {data.workoutsCount} sessão(ões) essa semana</li>
        {data.weight && (
          <li>
            Peso: {data.weight.currentKg} kg
            {data.weight.previousKg != null && ` (semana anterior: ${data.weight.previousKg} kg)`}
          </li>
        )}
        {data.budget && (
          <li>
            Orçamento do mês: {formatBRL(data.budget.spentCents)} de {formatBRL(data.budget.budgetCents)} planejados
            {data.budget.overCategories.length > 0 && (
              <span className="text-amber-700 dark:text-amber-400"> — passou do limite em {data.budget.overCategories.join(", ")}</span>
            )}
          </li>
        )}
        {data.medications.length > 0 && (
          <li className={hasMissedDoses ? "text-amber-700 dark:text-amber-400" : undefined}>
            Remédios: {data.medications.map((m) => `${m.name} (${m.takenDoses}/${m.expectedDoses}${m.missedDoses > 0 ? `, ${m.missedDoses} esquecida(s)` : ""})`).join(", ")}
          </li>
        )}
        {!data.habits && !data.weight && !data.budget && data.medications.length === 0 && data.workoutsCount === 0 && (
          <li className="text-zinc-500 dark:text-zinc-400">Sem dados suficientes essa semana ainda.</li>
        )}
      </ul>

      {summary ? (
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{summary}</p>
      ) : (
        <button type="button" onClick={handleGenerate} disabled={pending} className="self-start rounded-full border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
          {pending ? "Gerando…" : "Gerar frase com IA"}
        </button>
      )}
    </section>
  );
}
