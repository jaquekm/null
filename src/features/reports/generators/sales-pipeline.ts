import "server-only";
import type { z } from "zod";
import { getSalesDashboardData, getSalesTypeIds, type SalesDashboardData } from "@/features/sales/queries";
import { formatBRL } from "@/lib/money";
import type { ReportBlock } from "../lib/blocks";
import { baseReportParamsSchema } from "../schemas";
import type { ReportContext, ReportGenerator } from "../types";

export const salesPipelineParamsSchema = baseReportParamsSchema;
export type SalesPipelineParams = z.infer<typeof salesPipelineParamsSchema>;

export interface NextActionRow {
  opportunityTitle: string;
  nextStep: string;
  nextStepDate: string | null;
}

export interface SalesPipelineData extends SalesDashboardData {
  nextActions: NextActionRow[];
}

function stringProperty(properties: Record<string, unknown>, key: string): string | null {
  const raw = properties[key];
  return typeof raw === "string" && raw ? raw : null;
}

/** "Funil de vendas" (6.2b) — reaproveita `getSalesDashboardData` (5.6, painel /vendas) por inteiro e acrescenta "próximas ações" a partir de `next_step`/`next_step_date` das oportunidades abertas. */
export const salesPipelineReport: ReportGenerator<SalesPipelineParams, SalesPipelineData> = {
  kind: "sales_pipeline",
  label: "Funil de vendas",
  paramsSchema: salesPipelineParamsSchema,

  async collect(ctx: ReportContext<SalesPipelineParams>): Promise<SalesPipelineData> {
    const { supabase, timezone } = ctx;
    const typeIds = await getSalesTypeIds(supabase);
    if (!typeIds) {
      return {
        openValueCents: 0,
        openCount: 0,
        weightedForecastCents: 0,
        wonCount: 0,
        wonValueCents: 0,
        lostCount: 0,
        lostByReason: [],
        conversionFunnel: [],
        avgDurationDaysByStage: {},
        nextActions: [],
      };
    }

    const dashboard = await getSalesDashboardData(supabase, typeIds.opportunityTypeId, timezone);

    const { data } = await supabase
      .from("items")
      .select("title, properties")
      .eq("type_id", typeIds.opportunityTypeId)
      .is("deleted_at", null);
    const nextActions: NextActionRow[] = (data ?? [])
      .map((row) => {
        const properties = (row.properties as Record<string, unknown> | null) ?? {};
        const stage = stringProperty(properties, "stage");
        const nextStep = stringProperty(properties, "next_step");
        if (!nextStep || stage === "ganho" || stage === "perdido") return null;
        return { opportunityTitle: row.title || "Oportunidade", nextStep, nextStepDate: stringProperty(properties, "next_step_date") };
      })
      .filter((row): row is NextActionRow => row !== null)
      .sort((a, b) => (a.nextStepDate ?? "9999").localeCompare(b.nextStepDate ?? "9999"));

    return { ...dashboard, nextActions };
  },

  title() {
    return "Funil de vendas";
  },

  toBlocks(data): ReportBlock[] {
    return [
      {
        kind: "cards",
        items: [
          { label: "Em aberto", value: formatBRL(data.openValueCents) },
          { label: "Previsão ponderada (mês)", value: formatBRL(data.weightedForecastCents) },
          { label: "Ganhos", value: `${data.wonCount} (${formatBRL(data.wonValueCents)})`, tone: "emerald" },
          { label: "Perdidos", value: String(data.lostCount), tone: "red" },
        ],
      },
      {
        kind: "table",
        title: "Funil por etapa",
        columns: [
          { key: "stage", label: "Etapa" },
          { key: "count", label: "Itens", align: "right" },
          { key: "conversion", label: "Conversão p/ próxima", align: "right" },
          { key: "avgDays", label: "Tempo médio (dias)", align: "right" },
        ],
        rows: data.conversionFunnel.map((step) => ({
          stage: step.stage,
          count: String(step.reachedCount),
          conversion: step.conversionToNextPercent != null ? `${Math.round(step.conversionToNextPercent)}%` : "—",
          avgDays: data.avgDurationDaysByStage[step.stage] != null ? String(Math.round(data.avgDurationDaysByStage[step.stage]!)) : "—",
        })),
      },
      {
        kind: "list",
        title: "Perdidos por motivo",
        rows: data.lostByReason.map((row) => ({ label: row.reason, value: String(row.count) })),
        emptyText: "Nenhuma oportunidade perdida no período.",
      },
      {
        kind: "list",
        title: "Próximas ações",
        rows: data.nextActions.map((row) => ({ label: `${row.opportunityTitle}: ${row.nextStep}`, sublabel: row.nextStepDate ?? "sem data" })),
        emptyText: "Nenhuma próxima ação registrada.",
      },
    ];
  },
};
