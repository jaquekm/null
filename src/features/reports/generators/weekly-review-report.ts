import "server-only";
import type { z } from "zod";
import { computeTransactionTotals } from "@/features/financas/lib/transaction-totals";
import { listTransactions } from "@/features/financas/queries";
import { DATA_FIELD_KEY, getReuniaoType } from "@/features/meeting-notes/queries";
import { getObjectTypeBySlug } from "@/features/types/queries";
import { formatBRL } from "@/lib/money";
import type { ReportBlock } from "../lib/blocks";
import { baseReportParamsSchema } from "../schemas";
import type { ReportContext, ReportGenerator } from "../types";

export const weeklyReviewReportParamsSchema = baseReportParamsSchema;
export type WeeklyReviewReportParams = z.infer<typeof weeklyReviewReportParamsSchema>;

export interface WeeklyReviewReportData {
  itemsCreatedCount: number;
  tasksCompleted: { id: string; title: string }[];
  meetings: { id: string; title: string; date: string | null }[];
  financeEnabled: boolean;
  incomeCents: number;
  expenseCents: number;
  resultCents: number;
  studyMinutes: number;
}

/** "Revisão semanal" (relatório, 6.2b) — consolidação retrospectiva do período (itens criados, tarefas concluídas, reuniões, gastos, estudo). Diferente do passo a passo guiado de `/revisao-semanal` (5.8, prospectivo: pendências e próxima semana) — aqui é sempre olhando pra trás. */
export const weeklyReviewReport: ReportGenerator<WeeklyReviewReportParams, WeeklyReviewReportData> = {
  kind: "weekly_review",
  label: "Revisão semanal",
  paramsSchema: weeklyReviewReportParamsSchema,

  async collect(ctx: ReportContext<WeeklyReviewReportParams>): Promise<WeeklyReviewReportData> {
    const { supabase, ownerId, params, start, end } = ctx;
    const startDate = start.slice(0, 10);
    const endDate = end.slice(0, 10);

    const [itemsCreated, taskType, reuniaoType, settings] = await Promise.all([
      supabase.from("items").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).is("deleted_at", null).gte("created_at", start).lte("created_at", end),
      getObjectTypeBySlug(supabase, "tarefa"),
      getReuniaoType(supabase, ownerId),
      supabase.from("user_settings").select("modules").eq("owner_id", ownerId).maybeSingle(),
    ]);

    const tasksCompleted: { id: string; title: string }[] = [];
    if (taskType) {
      const { data } = await supabase.from("items").select("id, title, properties, updated_at").eq("type_id", taskType.id).is("deleted_at", null);
      for (const row of data ?? []) {
        const properties = (row.properties as Record<string, unknown>) ?? {};
        if (properties.status === "done" && row.updated_at >= start && row.updated_at <= end) tasksCompleted.push({ id: row.id, title: row.title || "Sem título" });
      }
    }

    let meetings: { id: string; title: string; date: string | null }[] = [];
    if (reuniaoType) {
      const { data } = await supabase.from("items").select("id, title, properties").eq("owner_id", ownerId).eq("type_id", reuniaoType.id).is("deleted_at", null);
      meetings = (data ?? [])
        .map((row) => {
          const properties = (row.properties as Record<string, unknown>) ?? {};
          const date = typeof properties[DATA_FIELD_KEY] === "string" ? (properties[DATA_FIELD_KEY] as string) : null;
          return { id: row.id, title: row.title || "Reunião", date };
        })
        .filter((m) => m.date && m.date >= start && m.date <= end);
    }

    const modules = (settings.data?.modules as Record<string, unknown> | null) ?? {};
    const financeEnabled = modules.finance === true;
    let incomeCents = 0;
    let expenseCents = 0;
    let resultCents = 0;
    if (financeEnabled) {
      const transactions = await listTransactions(supabase, { periodStart: startDate, periodEnd: endDate, spaceId: params.spaceId ?? undefined });
      const totals = computeTransactionTotals(transactions);
      incomeCents = totals.incomeCents;
      expenseCents = totals.expenseCents;
      resultCents = totals.resultCents;
    }

    const { data: sessions } = await supabase.from("study_sessions").select("duration_minutes").eq("owner_id", ownerId).gte("started_at", start).lte("started_at", end);
    const studyMinutes = (sessions ?? []).reduce((sum, row) => sum + (row.duration_minutes ?? 0), 0);

    return { itemsCreatedCount: itemsCreated.count ?? 0, tasksCompleted, meetings, financeEnabled, incomeCents, expenseCents, resultCents, studyMinutes };
  },

  title(_params, startDateKey, endDateKey) {
    return `Revisão — ${startDateKey} a ${endDateKey}`;
  },

  toBlocks(data): ReportBlock[] {
    const cards = [
      { label: "Itens criados", value: String(data.itemsCreatedCount) },
      { label: "Tarefas concluídas", value: String(data.tasksCompleted.length) },
      { label: "Reuniões", value: String(data.meetings.length) },
      { label: "Estudo (minutos)", value: String(data.studyMinutes) },
    ];
    if (data.financeEnabled) {
      cards.push(
        { label: "Entradas", value: formatBRL(data.incomeCents) },
        { label: "Saídas", value: formatBRL(data.expenseCents) },
        { label: "Resultado", value: formatBRL(data.resultCents) },
      );
    }
    return [
      { kind: "cards", items: cards },
      { kind: "list", title: "Tarefas concluídas", rows: data.tasksCompleted.map((t) => ({ label: t.title })), emptyText: "Nenhuma tarefa concluída no período." },
      {
        kind: "list",
        title: "Reuniões",
        rows: data.meetings.map((m) => ({ label: m.title, sublabel: m.date?.slice(0, 10) })),
        emptyText: "Nenhuma reunião no período.",
      },
    ];
  },
};
