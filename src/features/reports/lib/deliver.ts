import "server-only";
import { randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { getMessageChannel } from "@/lib/messaging";
import { notifyOwner } from "@/lib/messaging/notify-owner";
import type { ReportChannel, ReportKind } from "../schemas";
import type { Client } from "../types";
import { reportRunPlainText } from "./report-text";
import { ensureReportShareLink } from "./share";

export interface DeliverReportRunOptions {
  channels: ReportChannel[];
  deliverToMe: boolean;
  contactIds: string[];
  /** Bytes do PDF já gerado (job `generate_report`, logo depois do render) — `null` no reenvio manual, que baixa do Storage a partir de `pdfAttachmentId`. */
  pdfBuffer: Buffer | null;
  pdfAttachmentId: string | null;
  pdfFileName: string;
}

export interface DeliverReportRunResult {
  pushSent: boolean;
  emailSent: boolean;
  whatsappSent: number;
  whatsappSkipped: number;
}

async function resolvePdfBuffer(supabase: Client, options: DeliverReportRunOptions): Promise<Buffer | null> {
  if (options.pdfBuffer) return options.pdfBuffer;
  if (!options.pdfAttachmentId) return null;

  const { data: attachment } = await supabase.from("attachments").select("storage_path").eq("id", options.pdfAttachmentId).maybeSingle();
  if (!attachment) return null;

  const { data: file } = await supabase.storage.from("attachments").download(attachment.storage_path);
  if (!file) return null;
  return Buffer.from(await file.arrayBuffer());
}

/**
 * Entrega de uma execução de relatório (6.4) — push/e-mail pro dono,
 * WhatsApp pros contatos escolhidos (respeitando opt-in, mesma regra da
 * fase 3). Usada pelo job `generate_report` logo depois de gerar o PDF
 * (`pdfBuffer` em mãos) e pelo botão "Enviar" da tela (reenvio manual, sem
 * PDF em mãos — baixa do Storage só se for entregar por e-mail).
 */
export async function deliverReportRun(
  supabase: Client,
  ownerId: string,
  reportRunId: string,
  kind: ReportKind,
  title: string,
  data: unknown,
  options: DeliverReportRunOptions,
): Promise<DeliverReportRunResult> {
  const result: DeliverReportRunResult = { pushSent: false, emailSent: false, whatsappSent: 0, whatsappSkipped: 0 };
  const internalUrl = `${serverEnv.APP_URL}/relatorios/execucoes/${reportRunId}`;

  if (options.channels.includes("push") && options.deliverToMe) {
    await notifyOwner(ownerId, { title: `Relatório "${title}" pronto`, text: `Veja ou baixe: ${internalUrl}` });
    result.pushSent = true;
  }

  if (options.channels.includes("email") && options.deliverToMe) {
    const emailChannel = getMessageChannel("email");
    if (emailChannel) {
      const pdfBuffer = await resolvePdfBuffer(supabase, options);
      const highlights = reportRunPlainText(kind, data);
      try {
        await emailChannel.send({
          deliveryId: randomUUID(),
          to: serverEnv.OWNER_EMAIL,
          subject: title,
          text: `${highlights}\n\nVeja online: ${internalUrl}`,
          attachments: pdfBuffer ? [{ filename: options.pdfFileName, content: pdfBuffer, contentType: "application/pdf" }] : undefined,
        });
        result.emailSent = true;
      } catch {
        // melhor esforço — entrega por e-mail nunca derruba quem chamou (job ou ação manual).
      }
    }
  }

  if (options.channels.includes("whatsapp") && options.contactIds.length > 0) {
    const whatsappChannel = getMessageChannel("whatsapp");
    if (whatsappChannel) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, phone_e164, whatsapp_opt_in, opted_out_at")
        .eq("owner_id", ownerId)
        .in("id", options.contactIds);

      const eligible = (contacts ?? []).filter((c) => c.whatsapp_opt_in && !c.opted_out_at && c.phone_e164);
      result.whatsappSkipped = options.contactIds.length - eligible.length;

      if (eligible.length > 0) {
        const shareUrl = await ensureReportShareLink(supabase, ownerId, reportRunId);
        for (const contact of eligible) {
          try {
            await whatsappChannel.send({ deliveryId: randomUUID(), to: contact.phone_e164!, text: `${title}: ${shareUrl}` });
            result.whatsappSent += 1;
          } catch {
            // melhor esforço, por contato — um número inválido não derruba os outros.
          }
        }
      }
    }
  }

  return result;
}
