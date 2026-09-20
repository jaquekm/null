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

/** "Compartilhar" (3.11) — só itens por enquanto (listas/divisões/relatórios ficam pra depois, o enunciado já escalona assim). */
export async function createShareLink(input: z.input<typeof createShareLinkSchema>): Promise<Result<{ url: string }>> {
  const parsed = createShareLinkSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const { supabase, user } = await requireOwner();

  const { data: item } = await supabase.from("items").select("id").eq("id", parsed.data.resourceId).is("deleted_at", null).maybeSingle();
  if (!item) return fail("Item não encontrado.");

  const { token, prefix, hash } = generateShareToken();
  const passwordHash = parsed.data.password ? await hashSharePassword(parsed.data.password) : null;

  const { error } = await supabase.from("share_links").insert({
    owner_id: user.id,
    resource_type: "item",
    resource_id: parsed.data.resourceId,
    token_hash: hash,
    token_prefix: prefix,
    permission: parsed.data.permission,
    include_attachments: parsed.data.includeAttachments,
    password_hash: passwordHash,
    expires_at: computeShareExpiresAt(parsed.data.validity),
    contact_id: parsed.data.contactId ?? null,
    label: parsed.data.label?.trim() || null,
  });
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(`/itens/${parsed.data.resourceId}`);
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
    .select("resource_id")
    .maybeSingle();
  if (error) return fail("Não foi possível revogar o link. Tente de novo.");

  if (data?.resource_id) revalidatePath(`/itens/${data.resource_id}`);
  revalidatePath("/configuracoes/compartilhamentos");
  return ok(null);
}
