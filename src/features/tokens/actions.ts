"use server";

import { revalidatePath } from "next/cache";
import { generateToken } from "@/lib/tokens";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import { computeExpiresAt } from "./lib/expiry";
import { createTokenSchema } from "./schemas";

export interface CreatedToken {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  /** Valor completo — só existe aqui, na resposta da criação. Nunca é lido de volta do banco. */
  token: string;
}

export type CreateTokenState = Result<CreatedToken | null>;

export async function createToken(_prevState: CreateTokenState, formData: FormData): Promise<CreateTokenState> {
  const parsed = createTokenSchema.safeParse({
    name: formData.get("name"),
    scopes: formData.getAll("scopes"),
    validity: formData.get("validity"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Não foi possível criar o token.");

  const { supabase, user } = await requireOwner();
  const generated = generateToken();
  const expiresAt = computeExpiresAt(parsed.data.validity);

  const { data, error } = await supabase
    .from("api_tokens")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      token_prefix: generated.prefix,
      token_hash: generated.hash,
      scopes: parsed.data.scopes,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !data) return fail("Não foi possível criar o token.");

  revalidatePath("/configuracoes/tokens");
  return ok({
    id: data.id,
    name: parsed.data.name,
    prefix: generated.prefix,
    scopes: parsed.data.scopes,
    expiresAt,
    token: generated.token,
  });
}

export async function revokeToken(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) return fail("Não foi possível revogar o token.");

  revalidatePath("/configuracoes/tokens");
  return ok(null);
}
