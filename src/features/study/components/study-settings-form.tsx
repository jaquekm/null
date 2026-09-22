"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setStudySettings } from "../actions";
import type { StudySettings } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

/** Limite diário de novos cards e horário do push de revisão (5.7) — `user_settings.preferences.study`. */
export function StudySettingsForm({ initial }: { initial: StudySettings }) {
  const [dailyNewCardLimit, setDailyNewCardLimit] = useState(initial.dailyNewCardLimit);
  const [reviewPushHour, setReviewPushHour] = useState(initial.reviewPushHour);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await setStudySettings({ dailyNewCardLimit, reviewPushHour });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Configurações salvas.");
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Limite de novos cards por dia
        <input
          type="number"
          min={1}
          max={500}
          value={dailyNewCardLimit}
          onChange={(e) => setDailyNewCardLimit(Number(e.target.value) || 1)}
          className={`${inputClassName} w-28`}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Horário do lembrete diário
        <select value={reviewPushHour} onChange={(e) => setReviewPushHour(Number(e.target.value))} className={inputClassName}>
          {Array.from({ length: 24 }, (_, hour) => (
            <option key={hour} value={hour}>
              {String(hour).padStart(2, "0")}:00
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="rounded-full bg-black px-4 py-1.5 text-sm text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-black"
      >
        Salvar
      </button>
    </div>
  );
}
