import { NextResponse } from "next/server";
import { getAttachmentById } from "@/features/attachments/queries";
import { requireOwner } from "@/lib/auth";

const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60;

/**
 * Visualização/download de anexo (1.9): URL estável que sempre resolve para
 * uma URL assinada de curta duração gerada agora ("Download e visualização
 * por URL assinada... gerada no servidor"). Usar esse caminho estável (em
 * vez da URL assinada diretamente) no conteúdo do item evita que imagens
 * coladas no editor quebrem depois de 1 hora.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/attachments/[id]/file">) {
  const { id } = await ctx.params;
  const { supabase } = await requireOwner();

  const attachment = await getAttachmentById(supabase, id);
  if (!attachment) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const download = params.get("download") === "1";
  const wantsThumbnail = params.get("variant") === "thumbnail";
  const path = wantsThumbnail && attachment.thumbnailPath ? attachment.thumbnailPath : attachment.storagePath;

  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN_SECONDS, download ? { download: attachment.fileName } : undefined);

  if (error || !data) {
    return NextResponse.json({ error: "Não foi possível gerar o link do anexo." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
