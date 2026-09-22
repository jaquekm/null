"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getOwnerNotificationPreferences } from "@/features/settings/queries";
import { applyContactOptOut } from "@/lib/messaging/apply-contact-opt-out";
import { notifyOwner } from "@/lib/messaging/notify-owner";
import { verifyOptOutToken } from "@/lib/messaging/opt-out-token";
import { formatBRL } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { fail, ok, type Result } from "@/lib/result";
import { getRequestIp } from "./lib/get-request-ip";
import { isShareLinkActive } from "./lib/is-share-link-active";
import { createRateLimiter } from "./lib/rate-limit";
import { SHARE_AUTH_COOKIE_MAX_AGE_SECONDS, shareAuthCookieName, signShareAuthCookie, verifyShareAuthCookie } from "./lib/share-auth-cookie";
import { verifySharePassword as checkPasswordHash } from "./lib/share-password";
import { hashShareToken } from "./lib/share-token";
import { toggleTaskAtPath, type JSONContentNode } from "./lib/toggle-task-at-path";
import { findShareLinkByTokenHash, type ShareLinkAuthRow } from "./queries";
import { shareCommentSchema, sharePasswordFormSchema } from "./schemas";

const GENERIC_INVALID = "Link inválido ou expirado.";
const checkPasswordRateLimit = createRateLimiter(8, 5 * 60 * 1000);

/** Autenticado por senha (sem senha nenhuma, sempre "sim") — usado pelas outras actions públicas antes de qualquer efeito. */
async function isAuthenticatedForShareLink(shareLink: ShareLinkAuthRow): Promise<boolean> {
  if (!shareLink.passwordHash) return true;
  const cookieStore = await cookies();
  return verifyShareAuthCookie(shareLink.id, cookieStore.get(shareAuthCookieName(shareLink.id))?.value);
}

/** Formulário de senha do link (3.11) — cookie httpOnly assinado, 12h, escopado ao caminho do próprio token. */
export async function verifySharePassword(token: string, password: string): Promise<Result<null>> {
  const parsed = sharePasswordFormSchema.safeParse({ password });
  if (!parsed.success) return fail("Digite a senha.");

  const admin = createAdminClient();
  const shareLink = await findShareLinkByTokenHash(admin, hashShareToken(token));
  if (!shareLink || !isShareLinkActive(shareLink)) return fail(GENERIC_INVALID);
  if (!shareLink.passwordHash) return ok(null);

  const ip = await getRequestIp();
  if (checkPasswordRateLimit(`${ip}:${shareLink.id}`)) {
    return fail("Muitas tentativas. Espere um pouco e tente de novo.");
  }

  const valid = await checkPasswordHash(parsed.data.password, shareLink.passwordHash);
  if (!valid) return fail("Senha incorreta.");

  const cookieStore = await cookies();
  cookieStore.set(shareAuthCookieName(shareLink.id), signShareAuthCookie(shareLink.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: `/p/${token}`,
    maxAge: SHARE_AUTH_COOKIE_MAX_AGE_SECONDS,
  });

  return ok(null);
}

/** Permissão `check` (3.11) — só altera o estado desse checkbox específico no `content` do item, nada mais. */
export async function toggleShareChecklistItem(token: string, path: string, checked: boolean): Promise<Result<null>> {
  const admin = createAdminClient();
  const shareLink = await findShareLinkByTokenHash(admin, hashShareToken(token));
  if (!shareLink || !isShareLinkActive(shareLink)) return fail(GENERIC_INVALID);
  if (shareLink.permission !== "check" || shareLink.resourceType !== "item") return fail("Essa ação não é permitida por esse link.");
  if (!(await isAuthenticatedForShareLink(shareLink))) return fail("Não autenticado.");

  const { data: item } = await admin.from("items").select("content").eq("id", shareLink.resourceId).eq("owner_id", shareLink.ownerId).maybeSingle();
  if (!item) return fail("Item não encontrado.");

  const currentContent = (item.content as unknown as JSONContentNode | null) ?? { type: "doc", content: [] };
  const updated = toggleTaskAtPath(currentContent, path, checked);
  if (!updated) return fail("Não foi possível atualizar esse item.");

  const { error } = await admin
    .from("items")
    .update({ content: updated as unknown as Json })
    .eq("id", shareLink.resourceId)
    .eq("owner_id", shareLink.ownerId);
  if (error) return fail("Não foi possível salvar. Tente de novo.");

  revalidatePath(`/p/${token}`);
  return ok(null);
}

/** Permissão `comment` (3.11) — vira `share_comments` e, se configurado, um push pro dono (fecha a preferência deixada inerte na 3.9). */
export async function submitShareComment(token: string, input: { authorName: string; body: string }): Promise<Result<null>> {
  const parsed = shareCommentSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const admin = createAdminClient();
  const shareLink = await findShareLinkByTokenHash(admin, hashShareToken(token));
  if (!shareLink || !isShareLinkActive(shareLink)) return fail(GENERIC_INVALID);
  if (shareLink.permission !== "comment") return fail("Essa ação não é permitida por esse link.");
  if (!(await isAuthenticatedForShareLink(shareLink))) return fail("Não autenticado.");

  const { error } = await admin.from("share_comments").insert({
    owner_id: shareLink.ownerId,
    share_link_id: shareLink.id,
    author_name: parsed.data.authorName,
    body: parsed.data.body,
  });
  if (error) return fail("Não foi possível enviar o comentário. Tente de novo.");

  const preferences = await getOwnerNotificationPreferences(admin, shareLink.ownerId);
  if (preferences.shareComments) {
    await notifyOwner(shareLink.ownerId, {
      title: "Novo comentário no link compartilhado",
      text: `${parsed.data.authorName}: "${parsed.data.body.slice(0, 140)}"`,
    });
  }

  revalidatePath(`/p/${token}`);
  return ok(null);
}

/**
 * Permissão `settle` (4.10) — botão "Já paguei". Só grava `claimed_paid_at`
 * e avisa o dono; NUNCA marca a divisão/conta como quitada de verdade (só o
 * dono confirma isso, vendo o dinheiro cair ou pela conciliação da importação).
 */
export async function claimSharePayment(token: string): Promise<Result<null>> {
  const admin = createAdminClient();
  const shareLink = await findShareLinkByTokenHash(admin, hashShareToken(token));
  if (!shareLink || !isShareLinkActive(shareLink)) return fail(GENERIC_INVALID);
  if (shareLink.permission !== "settle") return fail("Essa ação não é permitida por esse link.");
  if (!(await isAuthenticatedForShareLink(shareLink))) return fail("Não autenticado.");

  const claimedAt = new Date().toISOString();

  if (shareLink.resourceType === "split") {
    const { data, error } = await admin
      .from("fin_split_shares")
      .update({ claimed_paid_at: claimedAt })
      .eq("id", shareLink.resourceId)
      .eq("owner_id", shareLink.ownerId)
      .select("share_cents, settled_cents, fin_splits(title)")
      .maybeSingle();
    if (error || !data) return fail("Não foi possível registrar. Tente de novo.");

    const splitTitle = (data.fin_splits as unknown as { title: string } | null)?.title ?? "Divisão";
    await notifyOwner(shareLink.ownerId, {
      title: '"Já paguei" recebido',
      text: `${splitTitle}: ${formatBRL(data.share_cents - data.settled_cents)} marcado como pago pelo link. Confirme quando ver o valor na conta.`,
    });
  } else if (shareLink.resourceType === "bill") {
    const { data, error } = await admin
      .from("fin_bills")
      .update({ claimed_paid_at: claimedAt })
      .eq("id", shareLink.resourceId)
      .eq("owner_id", shareLink.ownerId)
      .select("description, amount_cents, paid_cents")
      .maybeSingle();
    if (error || !data) return fail("Não foi possível registrar. Tente de novo.");

    await notifyOwner(shareLink.ownerId, {
      title: '"Já paguei" recebido',
      text: `${data.description}: ${formatBRL(data.amount_cents - data.paid_cents)} marcado como pago pelo link. Confirme quando ver o valor na conta.`,
    });
  } else {
    return fail("Essa ação não é permitida por esse link.");
  }

  revalidatePath(`/p/${token}`);
  return ok(null);
}

/** `/p/opt-out/[token]` (3.11) — token HMAC (`contactId` + canal), reverificado aqui mesmo já tendo sido checado na página. */
export async function confirmOptOut(token: string): Promise<Result<null>> {
  const payload = verifyOptOutToken(token);
  if (!payload) return fail(GENERIC_INVALID);

  const admin = createAdminClient();
  await applyContactOptOut(admin, { contactId: payload.contactId });

  return ok(null);
}
