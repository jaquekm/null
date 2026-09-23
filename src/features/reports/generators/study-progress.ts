import "server-only";
import type { z } from "zod";
import { computeAccuracyRate } from "@/features/study/lib/study-stats";
import { getStudyDashboardData, getStudyTypeIds, type StudyDashboardData } from "@/features/study/queries";
import type { ReportBlock } from "../lib/blocks";
import { baseReportParamsSchema } from "../schemas";
import type { ReportContext, ReportGenerator } from "../types";

export const studyProgressParamsSchema = baseReportParamsSchema;
export type StudyProgressParams = z.infer<typeof studyProgressParamsSchema>;

export interface StudyProgressData {
  installed: boolean;
  /** Painel da semana atual (mesma métrica de `/estudos`) — não do período do relatório, que pode ser maior que uma semana. */
  weekly: StudyDashboardData | null;
  coursesCompletedInPeriod: { id: string; title: string }[];
  booksCompletedInPeriod: { id: string; title: string }[];
  reviewsInPeriod: number;
  accuracyRatePercent: number | null;
}

/** "Progresso de estudos" (6.2b) — pack Estudos (5.7): reaproveita `getStudyDashboardData` (painel `/estudos`) e acrescenta cursos/livros concluídos e taxa de acerto do período escolhido no relatório. */
export const studyProgressReport: ReportGenerator<StudyProgressParams, StudyProgressData> = {
  kind: "study_progress",
  label: "Progresso de estudos",
  paramsSchema: studyProgressParamsSchema,

  async collect(ctx: ReportContext<StudyProgressParams>): Promise<StudyProgressData> {
    const { supabase, ownerId, timezone, start, end } = ctx;
    const typeIds = await getStudyTypeIds(supabase);
    if (!typeIds) return { installed: false, weekly: null, coursesCompletedInPeriod: [], booksCompletedInPeriod: [], reviewsInPeriod: 0, accuracyRatePercent: null };

    const [weekly, coursesResult, booksResult, reviewLogs] = await Promise.all([
      getStudyDashboardData(supabase, ownerId, timezone, typeIds),
      typeIds.courseTypeId
        ? supabase.from("items").select("id, title, properties, updated_at").eq("type_id", typeIds.courseTypeId).is("deleted_at", null)
        : Promise.resolve({ data: [] as { id: string; title: string; properties: unknown; updated_at: string }[] }),
      typeIds.bookTypeId
        ? supabase.from("items").select("id, title, properties, updated_at").eq("type_id", typeIds.bookTypeId).is("deleted_at", null)
        : Promise.resolve({ data: [] as { id: string; title: string; properties: unknown; updated_at: string }[] }),
      supabase.from("review_logs").select("rating").eq("owner_id", ownerId).gte("reviewed_at", start).lte("reviewed_at", end),
    ]);

    const coursesCompletedInPeriod = (coursesResult.data ?? [])
      .filter((row) => (row.properties as Record<string, unknown>)?.status === "concluido" && row.updated_at >= start && row.updated_at <= end)
      .map((row) => ({ id: row.id, title: row.title || "Sem título" }));
    const booksCompletedInPeriod = (booksResult.data ?? [])
      .filter((row) => (row.properties as Record<string, unknown>)?.status === "lido" && row.updated_at >= start && row.updated_at <= end)
      .map((row) => ({ id: row.id, title: row.title || "Sem título" }));

    const logs = reviewLogs.data ?? [];
    return {
      installed: true,
      weekly,
      coursesCompletedInPeriod,
      booksCompletedInPeriod,
      reviewsInPeriod: logs.length,
      accuracyRatePercent: computeAccuracyRate(logs),
    };
  },

  title() {
    return "Progresso de estudos";
  },

  toBlocks(data): ReportBlock[] {
    if (!data.installed || !data.weekly) return [{ kind: "text", body: "O pack Estudos não está instalado." }];
    return [
      {
        kind: "cards",
        items: [
          { label: "Minutos essa semana", value: String(data.weekly.minutesThisWeek) },
          { label: "Sequência (dias)", value: String(data.weekly.streakDays) },
          { label: "Revisões no período", value: String(data.reviewsInPeriod) },
          { label: "Taxa de acerto", value: data.accuracyRatePercent != null ? `${data.accuracyRatePercent}%` : "—" },
        ],
      },
      {
        kind: "list",
        title: "Cursos em andamento",
        rows: data.weekly.coursesInProgress.map((c) => ({ label: c.title, value: `${Math.round(c.progress)}%` })),
        emptyText: "Nenhum curso em andamento.",
      },
      {
        kind: "list",
        title: "Cursos concluídos no período",
        rows: data.coursesCompletedInPeriod.map((c) => ({ label: c.title, tone: "emerald" })),
        emptyText: "Nenhum curso concluído no período.",
      },
      {
        kind: "list",
        title: "Livros concluídos no período",
        rows: data.booksCompletedInPeriod.map((b) => ({ label: b.title, tone: "emerald" })),
        emptyText: "Nenhum livro concluído no período.",
      },
    ];
  },
};
