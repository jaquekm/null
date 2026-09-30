import type { WeeklyMeasure } from "../queries";

export type BmiCategory = "abaixo do peso" | "peso normal" | "sobrepeso" | "obesidade";

/** IMC = peso / altura² (OMS, adulto), com 1 casa decimal. */
export function calculateBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/** Faixas da OMS pra adulto (não vale pra gestante ou atleta com muita massa muscular — só um número, sem diagnóstico). */
export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return "abaixo do peso";
  if (bmi < 25) return "peso normal";
  if (bmi < 30) return "sobrepeso";
  return "obesidade";
}

export interface BmiPoint {
  weekStart: string;
  bmi: number | null;
}

/** Um IMC por semana registrada (10.6) — reaproveita o peso já salvo no semanal do Treinos, sem tabela nova; `null` = sem peso ou sem altura ainda. */
export function bmiSeries(weekly: Pick<WeeklyMeasure, "weekStart" | "weightKg">[], heightCm: number | null): BmiPoint[] {
  return weekly.map((w) => ({
    weekStart: w.weekStart,
    bmi: heightCm && w.weightKg ? calculateBmi(w.weightKg, heightCm) : null,
  }));
}
