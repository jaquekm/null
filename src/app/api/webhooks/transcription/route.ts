import { NextResponse } from "next/server";
import { applyTranscriptionResult } from "@/features/transcripts/lib/apply-result";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTranscriptionProvider } from "@/lib/transcription";

/**
 * Webhook do provedor de transcrição (2.6). **Nunca confia no conteúdo do
 * payload** — só usa o `externalId` que `verifyWebhook` confirma (segredo ou
 * assinatura, por provedor), e busca o resultado de verdade com
 * `fetchResult`. Responde 200 rápido mesmo quando não há nada a fazer
 * (transcript desconhecido, ou já resolvido antes — idempotente, webhook
 * repetido não duplica nada) pra não fazer o provedor reenviar achando que
 * falhou.
 */
export async function POST(request: Request) {
  const provider = getTranscriptionProvider();
  if (!provider) return NextResponse.json({ error: "Provedor de transcrição não configurado." }, { status: 401 });

  const verified = await provider.verifyWebhook(request);
  if (!verified) return NextResponse.json({ error: "Webhook inválido." }, { status: 401 });

  const admin = createAdminClient();
  const { data: transcript } = await admin
    .from("transcripts")
    .select("id, owner_id, item_id, provider, summarize, status")
    .eq("provider", provider.name)
    .eq("external_id", verified.externalId)
    .maybeSingle();

  if (!transcript || transcript.status !== "processing") {
    return NextResponse.json({ ok: true });
  }

  const result = await provider.fetchResult(verified.externalId);
  await applyTranscriptionResult(
    admin,
    {
      id: transcript.id,
      ownerId: transcript.owner_id,
      itemId: transcript.item_id,
      provider: transcript.provider,
      summarize: transcript.summarize,
    },
    result,
  );

  return NextResponse.json({ ok: true });
}
