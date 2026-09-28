import { NextResponse } from "next/server";
import { isShareLinkActive } from "@/features/sharing/lib/is-share-link-active";
import { isShareLinkUnlocked } from "@/features/sharing/lib/share-auth-cookie";
import { hashShareToken } from "@/features/sharing/lib/share-token";
import { findShareLinkByTokenHash, getPublicBillResource, getPublicSplitShareResource } from "@/features/sharing/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_EXPIRES_IN_SECONDS = 10 * 60;

// Função, não constante: o corpo de um `Response` só pode ser lido uma vez, então uma instância compartilhada quebra a partir do 2º 404.
const notFound = () => NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });

/** Recibo/anexo único de uma divisão ou conta (4.10) — igual ao anexo de item (3.11), mas sem `attachmentId` na URL: só existe um por recurso. */
export async function GET(request: Request, ctx: RouteContext<"/p/[token]/receipt">) {
  const { token } = await ctx.params;
  const admin = createAdminClient();

  const shareLink = await findShareLinkByTokenHash(admin, hashShareToken(token));
  if (!shareLink || !isShareLinkActive(shareLink) || !shareLink.includeAttachments) return notFound();
  if (!(await isShareLinkUnlocked(shareLink))) return NextResponse.redirect(new URL(`/p/${token}`, request.url));

  let attachmentId: string | null = null;
  if (shareLink.resourceType === "split") {
    const resource = await getPublicSplitShareResource(admin, shareLink.ownerId, shareLink.resourceId, { showFullSplit: false });
    attachmentId = resource?.attachmentId ?? null;
  } else if (shareLink.resourceType === "bill") {
    const resource = await getPublicBillResource(admin, shareLink.ownerId, shareLink.resourceId);
    attachmentId = resource?.attachmentId ?? null;
  }
  if (!attachmentId) return notFound();

  const { data: attachment } = await admin
    .from("attachments")
    .select("storage_path, file_name")
    .eq("id", attachmentId)
    .eq("owner_id", shareLink.ownerId)
    .maybeSingle();
  if (!attachment) return notFound();

  const { data, error } = await admin.storage
    .from("attachments")
    .createSignedUrl(attachment.storage_path, SIGNED_URL_EXPIRES_IN_SECONDS, { download: attachment.file_name });
  if (error || !data) return NextResponse.json({ error: "Não foi possível gerar o link do anexo." }, { status: 500 });

  return NextResponse.redirect(data.signedUrl);
}
