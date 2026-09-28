"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addDaysToDateString, todayInTimezone } from "@/lib/dates";
import { deleteWeeklyMeasure, saveWeeklyMeasure } from "../actions";
import { sessionsInWeek } from "../lib/csv-export";
import { parseDecimal } from "../lib/rules";
import type { WeeklyMeasure, WorkoutSession } from "../queries";
import { Field, cardClassName, formatShortDate, inputClassName } from "./ui";

export function WeeklyTab({ weekly, sessions, onChanged }: { weekly: WeeklyMeasure[]; sessions: WorkoutSession[]; onChanged: () => void }) {
  const [form, setForm] = useState({ weekStart: todayInTimezone(), weight: "", waist: "", steps: "" });
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await saveWeeklyMeasure({
        weekStart: form.weekStart,
        weightKg: parseDecimal(form.weight),
        waistCm: parseDecimal(form.waist),
        stepsAvg: form.steps === "" ? null : Number(form.steps),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Semana salva!");
      setForm({ weekStart: addDaysToDateString(form.weekStart, 7), weight: "", waist: "", steps: "" });
      onChanged();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteWeeklyMeasure(id);
      if (!result.ok) toast.error(result.error);
      else onChanged();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <section className={cardClassName}>
        <h2 className="font-semibold">Registro semanal</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Peso: média de 3–4 pesagens em jejum na semana. Cintura: na altura do umbigo. Salvar a mesma semana de novo substitui.</p>
        <div className="flex flex-wrap gap-3">
          <Field label="Início da semana">
            <input type="date" className={inputClassName} value={form.weekStart} onChange={(e) => setForm({ ...form, weekStart: e.target.value })} />
          </Field>
          <Field label="Peso médio (kg)">
            <input inputMode="decimal" className={`${inputClassName} w-24`} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
          </Field>
          <Field label="Cintura (cm)">
            <input inputMode="decimal" className={`${inputClassName} w-24`} value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} />
          </Field>
          <Field label="Passos/dia (média)">
            <input
              inputMode="numeric"
              className={`${inputClassName} w-28`}
              value={form.steps}
              onChange={(e) => setForm({ ...form, steps: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            />
          </Field>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="rounded-xl bg-black py-2.5 font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          Salvar semana
        </button>
      </section>

      <section className={cardClassName}>
        {weekly.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma semana registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                  <th className="py-1 font-medium">Semana</th>
                  <th className="font-medium">Peso</th>
                  <th className="font-medium">Cintura</th>
                  <th className="font-medium">Passos</th>
                  <th className="font-medium">Treinos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...weekly].reverse().map((w) => (
                  <tr key={w.id} className="border-t border-black/[.06] dark:border-white/[.06]">
                    <td className="py-1">{formatShortDate(w.weekStart)}</td>
                    <td>{w.weightKg?.toLocaleString("pt-BR") ?? "—"}</td>
                    <td>{w.waistCm?.toLocaleString("pt-BR") ?? "—"}</td>
                    <td>{w.stepsAvg?.toLocaleString("pt-BR") ?? "—"}</td>
                    <td>{sessionsInWeek(sessions, w.weekStart)}</td>
                    <td className="text-right">
                      <button type="button" disabled={pending} onClick={() => handleDelete(w.id)} className="text-xs text-red-600 hover:underline dark:text-red-400">
                        excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
