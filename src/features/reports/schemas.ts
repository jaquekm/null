import { z } from "zod";
import { viewFilterSchema } from "@/features/views/schemas";
import { relativePeriods } from "./lib/resolve-period";
import { visualizations } from "./lib/custom-report";

export const reportKinds = [
  "finance_monthly",
  "finance_category",
  "bills_forecast",
  "splits_statement",
  "sales_pipeline",
  "projects_status",
  "study_progress",
  "meetings_digest",
  "weekly_review",
  "custom",
] as const;
export type ReportKind = (typeof reportKinds)[number];

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  finance_monthly: "Financeiro mensal",
  finance_category: "Evolução de categoria",
  bills_forecast: "Previsão de contas",
  splits_statement: "Extrato de divisão",
  sales_pipeline: "Funil de vendas",
  projects_status: "Status de projetos",
  study_progress: "Progresso de estudos",
  meetings_digest: "Resumo de reuniões",
  weekly_review: "Revisão semanal",
  custom: "Personalizado",
};

/** Todo relatório pronto (6.2) aceita pelo menos isso — cada `kind` estende com os campos que precisar. */
export const baseReportParamsSchema = z.object({
  period: z.enum(relativePeriods).default("this_month"),
  customStart: z.string().optional(),
  customEnd: z.string().optional(),
  spaceId: z.string().uuid().nullable().default(null),
});
export type BaseReportParams = z.infer<typeof baseReportParamsSchema>;

export const deliverToSchema = z.object({
  me: z.boolean().default(true),
  contactIds: z.array(z.string().uuid()).default([]),
});

export const reportChannels = ["push", "email", "whatsapp"] as const;
export type ReportChannel = (typeof reportChannels)[number];

export const reportDefinitionInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(reportKinds),
  params: z.record(z.string(), z.unknown()).default({}),
  scheduleRrule: z.string().trim().min(1).nullable().default(null),
  deliverTo: deliverToSchema.default({ me: true, contactIds: [] }),
  channels: z.array(z.enum(reportChannels)).default(["push"]),
  includeAiSummary: z.boolean().default(false),
  enabled: z.boolean().default(true),
});
export type ReportDefinitionInput = z.infer<typeof reportDefinitionInputSchema>;

/** Fonte de uma seção do construtor (6.3): itens de um tipo (com filtros de visão, mesmo `ViewFilter` da 1.15) ou lançamentos financeiros. */
export const customReportSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("items"), typeId: z.string().uuid(), filters: z.array(viewFilterSchema).default([]) }),
  z.object({
    kind: z.literal("transactions"),
    accountId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional(),
    type: z.enum(["expense", "income"]).optional(),
  }),
]);
export type CustomReportSource = z.infer<typeof customReportSourceSchema>;

export const customReportGroupBySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("field"), field: z.string().min(1) }),
  z.object({ kind: z.literal("tag") }),
  z.object({ kind: z.literal("space") }),
  z.object({ kind: z.literal("category") }),
  z.object({ kind: z.literal("period"), granularity: z.enum(["day", "week", "month"]) }),
  z.object({ kind: z.literal("none") }),
]);
export type CustomReportGroupBy = z.infer<typeof customReportGroupBySchema>;

export const customReportMetricSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("count") }),
  z.object({ kind: z.literal("sum"), field: z.string().min(1) }),
  z.object({ kind: z.literal("avg"), field: z.string().min(1) }),
  z.object({ kind: z.literal("min"), field: z.string().min(1) }),
  z.object({ kind: z.literal("max"), field: z.string().min(1) }),
]);
export type CustomReportMetric = z.infer<typeof customReportMetricSchema>;

export const customReportSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  source: customReportSourceSchema,
  groupBy: customReportGroupBySchema,
  metric: customReportMetricSchema,
  visualization: z.enum(visualizations),
});
export type CustomReportSection = z.infer<typeof customReportSectionSchema>;

/** Configuração inteira do construtor (6.3) — guardada em `report_definitions.params.config` quando `kind = "custom"`. */
export const customReportConfigSchema = z.object({
  sections: z.array(customReportSectionSchema).min(1).max(10),
});
export type CustomReportConfig = z.infer<typeof customReportConfigSchema>;
