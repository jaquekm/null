import { NextResponse } from "next/server";
import { isShareLinkActive } from "@/features/sharing/lib/is-share-link-active";
import { hashShareToken } from "@/features/sharing/lib/share-token";
import { findShareLinkByTokenHash, getPublicReportRunResource } from "@/features/sharing/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_EXPIRES_IN_SECONDS = 10 * 60;

/** PDF de um relatório atrás de um link público (6.4) — mesmo padrão de `/p/[token]/attachments/[attachmentId]`. */
export async function GET(_request: Request, ctx: RouteContext<"/p/[token]/report-pdf">) {
  const { token } = await ctx.params;
  const admin = createAdminClient();

  const shareLink = await findShareLinkByTokenHash(admin, hashShareToken(token));
  if (!shareLink || !isShareLinkActive(shareLink) || shareLink.resourceType !== "report") {
    return NextResponse.json({ error: "Relatório não encontrado." }, { status: 404 });
  }

  const run = await getPublicReportRunResource(admin, shareLink.ownerId, shareLink.resourceId);
  if (!run?.pdfAttachmentId) {
    return NextResponse.json({ error: "PDF não encontrado." }, { status: 404 });
  }

  const { data: attachment } = await admin.from("attachments").select("storage_path, file_name").eq("id", run.pdfAttachmentId).maybeSingle();
  if (!attachment) {
    return NextResponse.json({ error: "PDF não encontrado." }, { status: 404 });
  }

  const { data, error } = await admin.storage
    .from("attachments")
    .createSignedUrl(attachment.storage_path, SIGNED_URL_EXPIRES_IN_SECONDS, { download: attachment.file_name });
  if (error || !data) {
    return NextResponse.json({ error: "Não foi possível gerar o link do PDF." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
