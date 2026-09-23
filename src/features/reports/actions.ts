"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { fail, ok, type Result } from "@/lib/result";
import { customReport } from "./generators/custom";
import type { ReportBlock } from "./lib/blocks";
import { deliverReportRun } from "./lib/deliver";
import { relativePeriods } from "./lib/resolve-period";
import { runReport } from "./lib/run-report";
import { ensureReportShareLink } from "./lib/share";
import { createReportDefinition, deleteReportDefinition, getReportRun, updateReportDefinition, type ReportDefinitionRow } from "./queries";
import { customReportConfigSchema, reportChannels, reportDefinitionInputSchema, reportKinds } from "./schemas";

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

/**
 * Salva uma definição de relatório (novo ou edição) — usada pelo construtor
 * de personalizados (6.3, `kind: "custom"`, `params.config` guarda as
 * seções) e, desde a 6.4, também por qualquer relatório pronto que o dono
 * queira agendar (`/relatorios`, `params` só com período/espaço).
 */
export async function saveReportDefinition(id: string | null, input: unknown): Promise<Result<{ id: string }>> {
  const { supabase, user } = await requireOwner();
  const parsed = reportDefinitionInputSchema.safeParse(input);
  if (!parsed.success) return fail("Não foi possível salvar: revise os campos.");

  try {
    if (id) {
      await updateReportDefinition(supabase, user.id, id, parsed.data);
      revalidatePath("/relatorios");
      return ok({ id });
    }
    const newId = await createReportDefinition(supabase, user.id, parsed.data);
    revalidatePath("/relatorios");
    return ok({ id: newId });
  } catch {
    return fail("Não foi possível salvar o relatório.");
  }
}

export async function deleteReportDefinitionAction(id: string): Promise<Result<null>> {
  const { supabase } = await requireOwner();
  try {
    await deleteReportDefinition(supabase, id);
    revalidatePath("/relatorios");
    return ok(null);
  } catch {
    return fail("Não foi possível excluir o relatório.");
  }
}

const generateNowInputSchema = z.union([
  z.object({ definitionId: z.string().uuid() }),
  z.object({ kind: z.enum(reportKinds), params: z.record(z.string(), z.unknown()).default({}) }),
]);

/**
 * "Gerar agora" (6.4, `/relatorios`) — enfileira `generate_report` e volta na
 * hora; a coleta, o PDF e a entrega acontecem no job (assíncrono, o dono é
 * avisado por push quando terminar). Aceita uma definição salva ou, pra um
 * relatório pronto sem agendamento nenhum, `kind` + parâmetros direto.
 */
export async function generateReportNow(input: z.input<typeof generateNowInputSchema>): Promise<Result<null>> {
  const { user } = await requireOwner();
  const parsed = generateNowInputSchema.safeParse(input);
  if (!parsed.success) return fail("Não foi possível gerar o relatório.");

  await enqueueJob({ ownerId: user.id, kind: "generate_report", payload: parsed.data });
  return ok(null);
}

/** Link público de uma execução (6.4, botão "Compartilhar" na tela do relatório) — sempre cria um novo, o token só existe uma vez. */
export async function getReportShareUrl(reportRunId: string): Promise<Result<{ url: string }>> {
  const { supabase, user } = await requireOwner();
  try {
    const url = await ensureReportShareLink(supabase, user.id, reportRunId);
    return ok({ url });
  } catch {
    return fail("Não foi possível criar o link.");
  }
}

const resendReportRunInputSchema = z.object({
  channels: z.array(z.enum(reportChannels)).min(1),
  contactIds: z.array(z.string().uuid()).default([]),
});

/** Botão "Enviar" da tela do relatório (6.4) — reenvio manual, sem regerar PDF nem dados (usa o snapshot já salvo). */
export async function resendReportRun(reportRunId: string, input: z.input<typeof resendReportRunInputSchema>): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const parsed = resendReportRunInputSchema.safeParse(input);
  if (!parsed.success) return fail("Escolha ao menos um canal.");

  const run = await getReportRun(supabase, reportRunId);
  if (!run) return fail("Relatório não encontrado.");

  await deliverReportRun(supabase, user.id, run.id, run.kind, run.title, run.data, {
    channels: parsed.data.channels,
    deliverToMe: parsed.data.channels.includes("push") || parsed.data.channels.includes("email"),
    contactIds: parsed.data.contactIds,
    pdfBuffer: null,
    pdfAttachmentId: run.pdfAttachmentId,
    pdfFileName: `${run.title}.pdf`,
  });
  return ok(null);
}

export type { ReportDefinitionRow };
