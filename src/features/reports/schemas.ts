import { z } from "zod";
import { relativePeriods } from "./lib/resolve-period";

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
