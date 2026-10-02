import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCategoryBudgetProgress, sumExpensesByCategory } from "@/features/financas/lib/budget-progress";
import { monthPeriod } from "@/features/financas/lib/period-range";
import { listCategories, listTransactions } from "@/features/financas/queries";
import { dayCompletion } from "@/features/habits/lib/habit-week";
import { listRotinaHabits } from "@/features/habits/queries";
import { missedDosesForWeek, type MedicationDoseUsage } from "@/features/medications/lib/dose-log";
import { listMedications } from "@/features/medications/queries";
import { listWeeklyMeasures, listWorkoutSessions } from "@/features/treinos/queries";
import { addDaysToDateString } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
const WEEK_DAYS = 7;

export interface WeeklyCheckinData {
  /** `null` = tipo Hábito ainda não existe (card nem aparece). */
  habits: { done: number; scheduled: number } | null;
  /** `null` = módulo Finanças desligado ou nenhuma categoria com orçamento definido. */
  budget: { spentCents: number; budgetCents: number; overCategories: string[] } | null;
  workoutsCount: number;
  /** `null` = nenhum peso registrado ainda. `previousKg` só existe com 2+ semanas registradas. */
  weight: { currentKg: number; previousKg: number | null } | null;
  medications: MedicationDoseUsage[];
}

/**
 * Revisão da semana automática (10.16): consistência dos hábitos, gastos ×
 * orçamento, treinos, peso e remédios esquecidos — tudo calculado a partir
 * de dados que já existem (hábitos 10.1, orçamento 4.11, treinos/peso fase
 * anterior a 10.x, remédios 10.5/10.16). Cada sinal falta (`null`) sem
 * travar os outros quando o módulo/pack correspondente não está em uso.
 */
export async function getWeeklyCheckinData(supabase: Client, ownerId: string, timezone: string, today: string): Promise<WeeklyCheckinData> {
  const weekStart = addDaysToDateString(today, -(WEEK_DAYS - 1));
  const days = Array.from({ length: WEEK_DAYS }, (_, i) => addDaysToDateString(weekStart, i));

  const [rotinaHabits, settings, weeklyMeasures, sessions, medications, doseLogsResult] = await Promise.all([
    listRotinaHabits(supabase, timezone),
    supabase.from("user_settings").select("modules").eq("owner_id", ownerId).maybeSingle(),
    listWeeklyMeasures(supabase, ownerId),
    listWorkoutSessions(supabase, ownerId),
    listMedications(supabase),
    supabase.from("medication_dose_logs").select("item_id").eq("owner_id", ownerId).gte("taken_at", `${weekStart}T00:00:00.000Z`),
  ]);

  const habits = rotinaHabits.hasHabitType
    ? days.reduce(
        (acc, day) => {
          const completion = dayCompletion(rotinaHabits.habits, day);
          return { done: acc.done + completion.done, scheduled: acc.scheduled + completion.scheduled };
        },
        { done: 0, scheduled: 0 },
      )
    : null;

  const modules = (settings.data?.modules as Record<string, unknown> | null) ?? {};
  const budget = modules.finance === true ? await getBudgetSummary(supabase, today) : null;

  const workoutsCount = sessions.filter((session) => days.includes(session.date)).length;

  const measuresWithWeight = [...weeklyMeasures].filter((m) => m.weightKg != null).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const weight =
    measuresWithWeight.length > 0
      ? { currentKg: measuresWithWeight.at(-1)!.weightKg!, previousKg: measuresWithWeight.length > 1 ? measuresWithWeight.at(-2)!.weightKg! : null }
      : null;

  const takenCountByMedicationId = new Map<string, number>();
  for (const row of doseLogsResult.data ?? []) takenCountByMedicationId.set(row.item_id, (takenCountByMedicationId.get(row.item_id) ?? 0) + 1);
  const medicationUsage = missedDosesForWeek(
    medications.map((m) => ({ id: m.id, name: m.title, horarios: m.horarios })),
    takenCountByMedicationId,
    WEEK_DAYS,
  );

  return { habits, budget, workoutsCount, weight, medications: medicationUsage };
}

async function getBudgetSummary(supabase: Client, today: string): Promise<WeeklyCheckinData["budget"]> {
  const period = monthPeriod(today.slice(0, 7));
  const [categories, transactions] = await Promise.all([
    listCategories(supabase),
    listTransactions(supabase, { periodStart: period.start, periodEnd: period.end, type: "expense" }),
  ]);

  const budgeted = categories.filter((c) => c.kind === "expense" && c.monthlyBudgetCents != null && c.monthlyBudgetCents > 0);
  if (budgeted.length === 0) return null;

  const spentByCategory = sumExpensesByCategory(transactions.map((t) => ({ categoryId: t.categoryId, amountCents: t.amountCents })));
  const progress = computeCategoryBudgetProgress(budgeted.map((c) => ({ id: c.id, budgetCents: c.monthlyBudgetCents })), spentByCategory);
  const progressById = new Map(progress.map((p) => [p.categoryId, p]));

  return {
    spentCents: progress.reduce((sum, p) => sum + p.spentCents, 0),
    budgetCents: budgeted.reduce((sum, c) => sum + (c.monthlyBudgetCents ?? 0), 0),
    overCategories: budgeted.filter((c) => progressById.get(c.id)?.status === "over").map((c) => c.name),
  };
}
