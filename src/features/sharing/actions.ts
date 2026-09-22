"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { fail, ok, type Result } from "@/lib/result";
import { computeShareExpiresAt } from "./lib/compute-expires-at";
import { generateShareToken } from "./lib/share-token";
import { hashSharePassword } from "./lib/share-password";
import { createShareLinkSchema } from "./schemas";

const GENERIC_ERROR = "Não foi possível criar o link. Tente de novo.";

/** Caminho da página que mostra o link (pra revalidar depois de criar/revogar) — item tem página própria, split/bill só a lista (4.10). */
function pathForResource(resourceType: string, resourceId: string): string {
  if (resourceType === "split") return "/financas/dividir";
  if (resourceType === "bill") return "/financas/contas";
  return `/itens/${resourceId}`;
}

/** "Compartilhar" (3.11) + Pix/cobrança (4.10) — item, e agora também split (por participante) e bill. */
export async function createShareLink(input: z.input<typeof createShareLinkSchema>): Promise<Result<{ url: string }>> {
  const parsed = createShareLinkSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const { supabase, user } = await requireOwner();
  const { resourceType, resourceId } = parsed.data;

  if (resourceType === "item") {
    const { data: item } = await supabase.from("items").select("id").eq("id", resourceId).is("deleted_at", null).maybeSingle();
    if (!item) return fail("Item não encontrado.");
  } else if (resourceType === "split") {
    const { data: share } = await supabase.from("fin_split_shares").select("id").eq("id", resourceId).eq("owner_id", user.id).maybeSingle();
    if (!share) return fail("Participante da divisão não encontrado.");
  } else {
    const { data: bill } = await supabase.from("fin_bills").select("id").eq("id", resourceId).eq("owner_id", user.id).maybeSingle();
    if (!bill) return fail("Conta não encontrada.");
  }

  const { token, prefix, hash } = generateShareToken();
  const passwordHash = parsed.data.password ? await hashSharePassword(parsed.data.password) : null;

  const { error } = await supabase.from("share_links").insert({
    owner_id: user.id,
    resource_type: resourceType,
    resource_id: resourceId,
    token_hash: hash,
    token_prefix: prefix,
    permission: parsed.data.permission,
    include_attachments: parsed.data.includeAttachments,
    show_full_split: parsed.data.showFullSplit,
    password_hash: passwordHash,
    expires_at: computeShareExpiresAt(parsed.data.validity),
    contact_id: parsed.data.contactId ?? null,
    label: parsed.data.label?.trim() || null,
  });
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(pathForResource(resourceType, resourceId));
  revalidatePath("/configuracoes/compartilhamentos");
  return ok({ url: `${serverEnv.APP_URL}/p/${token}` });
}

export async function revokeShareLink(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { data, error } = await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("resource_type, resource_id")
    .maybeSingle();
  if (error) return fail("Não foi possível revogar o link. Tente de novo.");

  if (data) revalidatePath(pathForResource(data.resource_type, data.resource_id));
  revalidatePath("/configuracoes/compartilhamentos");
  return ok(null);
}
