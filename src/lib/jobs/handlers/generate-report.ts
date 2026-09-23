import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { buildStoragePath } from "@/features/attachments/lib/build-storage-path";
import { deliverReportRun } from "@/features/reports/lib/deliver";
import { reportRunPlainText } from "@/features/reports/lib/report-text";
import { renderReportPdf } from "@/features/reports/lib/render-pdf";
import { runReport } from "@/features/reports/lib/run-report";
import { getReportGenerator } from "@/features/reports/registry";
import { getReportDefinition, saveReportRun, updateReportRunPdfAttachment } from "@/features/reports/queries";
import { reportKinds, type ReportChannel, type ReportKind } from "@/features/reports/schemas";
import { AiBudgetExceededError, AiDisabledError, callClaude } from "@/lib/ai/claude";
import type { JobHandler } from "../types";

const payloadSchema = z.union([
  z.object({ definitionId: z.string().uuid() }),
  z.object({ kind: z.enum(reportKinds), params: z.record(z.string(), z.unknown()).default({}) }),
]);

const REPORT_SUMMARY_SYSTEM_PROMPT =
  "Você resume relatórios em português do Brasil, com fidelidade aos números, em 2 ou 3 frases curtas destacando o que mais importa.";

/** Resumo por IA opcional (6.4) — melhor esforço: módulo desligado ou orçamento estourado não derruba o relatório, só fica sem resumo. */
async function summarizeReport(ownerId: string, title: string, plainText: string): Promise<string | null> {
  try {
    const result = await callClaude({ ownerId, feature: "report_summary", system: REPORT_SUMMARY_SYSTEM_PROMPT, messages: [{ role: "user", content: `${title}\n\n${plainText}` }] });
    return result.text;
  } catch (err) {
    if (err instanceof AiDisabledError || err instanceof AiBudgetExceededError) return null;
    throw err;
  }
}

/**
 * Job `generate_report` (6.4): coleta os dados (`runReport`, motor da 6.2) →
 * gera o PDF (`renderReportPdf`) → salva como anexo avulso (`item_id: null`,
 * mesma convenção de boleto de conta a pagar, 4.8 — sem tipo de sistema
 * "Relatórios" dedicado, o enunciado permite os dois: "anexo em item de
 * sistema... ou avulso") → snapshot em `report_runs` → resumo de IA opcional
 * → entrega (`deliverReportRun`, compartilhado com o botão "Enviar" manual).
 * Aceita `{ definitionId }` (usa `params`/`channels`/`deliverTo` salvos) ou
 * `{ kind, params }` direto (ad hoc, "Gerar agora" sem definição — entrega
 * só por push pro dono).
 */
export const generateReport: JobHandler = async (job, { supabase }) => {
  const parsedPayload = payloadSchema.safeParse(job.payload);
  if (!parsedPayload.success) return { status: "failed", error: "Payload inválido para generate_report." };

  const ownerId = job.owner_id;
  let kind: ReportKind;
  let rawParams: unknown;
  let definitionId: string | null = null;
  let channels: ReportChannel[] = ["push"];
  let deliverToMe = true;
  let contactIds: string[] = [];
  let includeAiSummary = false;

  if ("definitionId" in parsedPayload.data) {
    const definition = await getReportDefinition(supabase, parsedPayload.data.definitionId);
    if (!definition) return { status: "failed", error: "Definição de relatório não encontrada." };
    kind = definition.kind;
    rawParams = definition.params;
    definitionId = definition.id;
    channels = definition.channels;
    deliverToMe = definition.deliverTo.me;
    contactIds = definition.deliverTo.contactIds;
    includeAiSummary = definition.includeAiSummary;
  } else {
    kind = parsedPayload.data.kind;
    rawParams = parsedPayload.data.params;
  }

  const generator = getReportGenerator(kind);
  if (!generator) return { status: "failed", error: `Relatório "${kind}" não tem gerador registrado.` };

  const ran = await runReport(generator, supabase, ownerId, rawParams);
  const pdfBuffer = await renderReportPdf(kind, ran.title, `${ran.periodStart} – ${ran.periodEnd}`, ran.data);

  const sha256 = createHash("sha256").update(pdfBuffer).digest("hex");
  const fileName = `${ran.title}.pdf`;
  const storagePath = buildStoragePath(ownerId, null, randomUUID(), fileName);

  const { error: uploadError } = await supabase.storage.from("attachments").upload(storagePath, pdfBuffer, { contentType: "application/pdf" });
  if (uploadError) return { status: "retry", error: uploadError.message };

  const { data: attachment, error: attachmentError } = await supabase
    .from("attachments")
    .insert({
      owner_id: ownerId,
      item_id: null,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: "application/pdf",
      size_bytes: pdfBuffer.byteLength,
      sha256,
      extraction_status: "none",
    })
    .select("id")
    .single();
  if (attachmentError || !attachment) return { status: "retry", error: attachmentError?.message ?? "Falha ao registrar o PDF." };

  const aiSummary = includeAiSummary ? await summarizeReport(ownerId, ran.title, reportRunPlainText(kind, ran.data)) : null;

  const reportRunId = await saveReportRun(supabase, ownerId, {
    definitionId,
    kind,
    title: ran.title,
    periodStart: ran.periodStart,
    periodEnd: ran.periodEnd,
    data: ran.data,
    aiSummary,
  });
  await updateReportRunPdfAttachment(supabase, reportRunId, attachment.id);

  const delivery = await deliverReportRun(supabase, ownerId, reportRunId, kind, ran.title, ran.data, {
    channels,
    deliverToMe,
    contactIds,
    pdfBuffer,
    pdfAttachmentId: attachment.id,
    pdfFileName: fileName,
  });

  return { status: "done", result: { reportRunId, ...delivery } };
};
