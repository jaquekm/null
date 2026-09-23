"use server";

import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import { customReport } from "./generators/custom";
import type { ReportBlock } from "./lib/blocks";
import { relativePeriods } from "./lib/resolve-period";
import { runReport } from "./lib/run-report";
import { createReportDefinition, deleteReportDefinition, updateReportDefinition, type ReportDefinitionRow } from "./queries";
import { customReportConfigSchema, reportDefinitionInputSchema } from "./schemas";

const previewCustomReportInputSchema = z.object({
  period: z.enum(relativePeriods).default("this_month"),
  customStart: z.string().optional(),
  customEnd: z.string().optional(),
  spaceId: z.string().uuid().nullable().default(null),
  config: customReportConfigSchema,
});

/** Preview em tempo real do construtor (6.3, `/relatorios/novo`) — roda o generator `custom` sem gravar nada em `report_runs`/`report_definitions`. */
export async function previewCustomReport(input: unknown): Promise<Result<{ title: string; blocks: ReportBlock[] }>> {
  const { supabase, user } = await requireOwner();
  const parsed = previewCustomReportInputSchema.safeParse(input);
  if (!parsed.success) return fail("Configuração inválida.");

  try {
    const ran = await runReport(customReport, supabase, user.id, parsed.data);
    const blocks = customReport.toBlocks!(ran.data);
    return ok({ title: ran.title, blocks });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Não foi possível gerar a prévia.");
  }
}

/** Salva um relatório personalizado (novo ou edição) — `report_definitions.kind = "custom"`, `params.config` guarda as seções. */
export async function saveCustomReportDefinition(id: string | null, input: unknown): Promise<Result<{ id: string }>> {
  const { supabase, user } = await requireOwner();
  const parsed = reportDefinitionInputSchema.safeParse(input);
  if (!parsed.success) return fail("Não foi possível salvar: revise os campos.");
  if (parsed.data.kind !== "custom") return fail("Esta ação só salva relatórios personalizados.");

  try {
    if (id) {
      await updateReportDefinition(supabase, id, parsed.data);
      return ok({ id });
    }
    const newId = await createReportDefinition(supabase, user.id, parsed.data);
    return ok({ id: newId });
  } catch {
    return fail("Não foi possível salvar o relatório.");
  }
}

export async function deleteReportDefinitionAction(id: string): Promise<Result<null>> {
  const { supabase } = await requireOwner();
  try {
    await deleteReportDefinition(supabase, id);
    return ok(null);
  } catch {
    return fail("Não foi possível excluir o relatório.");
  }
}

export type { ReportDefinitionRow };
