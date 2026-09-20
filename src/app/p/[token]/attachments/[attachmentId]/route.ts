import { NextResponse } from "next/server";
import { isShareLinkActive } from "@/features/sharing/lib/is-share-link-active";
import { hashShareToken } from "@/features/sharing/lib/share-token";
import { findShareLinkByTokenHash, getPublicAttachmentFile } from "@/features/sharing/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_EXPIRES_IN_SECONDS = 10 * 60;

/** Anexo de um link público (3.11) — URL assinada de 10 min, só se o link permitir anexos. */
export async function GET(_request: Request, ctx: RouteContext<"/p/[token]/attachments/[attachmentId]">) {
  const { token, attachmentId } = await ctx.params;
  const admin = createAdminClient();

  const shareLink = await findShareLinkByTokenHash(admin, hashShareToken(token));
  if (!shareLink || !isShareLinkActive(shareLink) || shareLink.resourceType !== "item" || !shareLink.includeAttachments) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  const attachment = await getPublicAttachmentFile(admin, shareLink.ownerId, shareLink.resourceId, attachmentId);
  if (!attachment) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  const { data, error } = await admin.storage
    .from("attachments")
    .createSignedUrl(attachment.storagePath, SIGNED_URL_EXPIRES_IN_SECONDS, { download: attachment.fileName });
  if (error || !data) {
    return NextResponse.json({ error: "Não foi possível gerar o link do anexo." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
