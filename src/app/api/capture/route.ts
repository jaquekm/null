import { NextResponse } from "next/server";
import { z } from "zod";
import { createCaptureItem } from "@/features/capture/lib/create-capture-item";
import { fetchPageTitle } from "@/features/capture/lib/fetch-page-title";
import { isRateLimited } from "@/features/capture/lib/rate-limit";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyApiToken } from "@/lib/tokens";

const captureSchema = z
  .object({
    title: z.string().max(500).optional(),
    text: z.string().max(100_000).optional(),
    url: z.string().url().optional(),
    tags: z.array(z.string()).max(20).optional(),
    space: z.string().optional(),
    type: z.string().optional(),
  })
  .refine((d) => d.title || d.text || d.url, "Envie ao menos title, text ou url");

/**
 * Rota pública (1.10) — token pessoal com escopo `capture`. Preenche
 * `owner_id` explicitamente porque roda com o cliente admin (sem sessão de
 * usuário aqui, `auth.uid()` seria nulo).
 */
export async function POST(request: Request) {
  const verified = await verifyApiToken(request, "capture");
  if (!verified) {
    return NextResponse.json(
      { error: "Token inválido, revogado, expirado ou sem o escopo capture." },
      { status: 401 },
    );
  }

  if (isRateLimited(verified.tokenId)) {
    return NextResponse.json({ error: "Limite de requisições excedido. Tente de novo em instantes." }, { status: 429 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = captureSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const admin = createAdminClient();

  let spaceId: string | null = null;
  if (parsed.data.space) {
    const { data: space } = await admin
      .from("spaces")
      .select("id")
      .eq("owner_id", verified.ownerId)
      .eq("slug", parsed.data.space)
      .maybeSingle();
    spaceId = space?.id ?? null;
  }

  let typeId: string | null = null;
  if (parsed.data.type) {
    const { data: type } = await admin
      .from("object_types")
      .select("id")
      .eq("owner_id", verified.ownerId)
      .eq("slug", parsed.data.type)
      .maybeSingle();
    typeId = type?.id ?? null;
  }

  const url = parsed.data.url;
  const bodyText = parsed.data.text ?? "";
  let title = parsed.data.title?.trim() ?? "";

  if (!title && url) {
    title = (await fetchPageTitle(url)) ?? url;
  }
  if (!title) {
    title = bodyText.split("\n")[0]?.slice(0, 500) ?? "";
  }

  const fullBody = url && !bodyText.includes(url) ? [bodyText, url].filter(Boolean).join("\n") : bodyText;

  const result = await createCaptureItem(admin, {
    ownerId: verified.ownerId,
    title: title || "Sem título",
    body: fullBody,
    spaceId,
    typeId,
    source: "api",
    sourceUrl: url ?? null,
  });

  if (!result) {
    return NextResponse.json({ error: "Não foi possível capturar." }, { status: 500 });
  }

  if (parsed.data.tags && parsed.data.tags.length > 0) {
    for (const rawName of parsed.data.tags) {
      const name = rawName.trim().toLowerCase();
      if (!name) continue;
      const { data: tag } = await admin
        .from("tags")
        .upsert({ owner_id: verified.ownerId, name }, { onConflict: "owner_id,name" })
        .select("id")
        .single();
      if (tag) {
        await admin
          .from("item_tags")
          .upsert({ item_id: result.id, tag_id: tag.id, owner_id: verified.ownerId }, { onConflict: "item_id,tag_id" });
      }
    }
  }

  return NextResponse.json({ id: result.id, url: `${serverEnv.APP_URL}/itens/${result.id}` });
}
