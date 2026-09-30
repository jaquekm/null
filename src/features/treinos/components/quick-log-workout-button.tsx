"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { saveWorkoutSession } from "../actions";

/** "Marquei, sem detalhar" no Hoje (10.8): sessão mínima (sem exercícios), pra não obrigar abrir Treinos só pra registrar que treinou. */
export function QuickLogWorkoutButton({ programId, date, week, letter }: { programId: string; date: string; week: number; letter: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await saveWorkoutSession({
        programId,
        date,
        week,
        workout: letter,
        sleepHours: null,
        energy: 3,
        kneePainBefore: 0,
        backPainBefore: 0,
        swelling: false,
        sick: false,
        exercises: {},
        durationMin: null,
        kneePainAfter: null,
        backPainAfter: null,
        notes: "Marcado como feito direto no Hoje.",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Treino de hoje registrado!");
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={pending} className="self-start text-xs font-medium text-brand-text hover:underline disabled:opacity-60">
      Marquei, sem detalhar
    </button>
  );
}
