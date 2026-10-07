"use server";

import type { JSONContent } from "@tiptap/core";
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
import { isShareLinkUnlocked, SHARE_AUTH_COOKIE_MAX_AGE_SECONDS, shareAuthCookieName, signShareAuthCookie } from "./lib/share-auth-cookie";
import { verifySharePassword as checkPasswordHash } from "./lib/share-password";
import { hashShareToken } from "./lib/share-token";
import { editableListStyle } from "./lib/editable-list";
import { applyListEdit, listEditOpSchema } from "./lib/list-edit";
import { taskTextAtPath, toggleTaskAtPath, type JSONContentNode } from "./lib/toggle-task-at-path";
import { findShareLinkByTokenHash } from "./queries";
import { shareCommentSchema, sharePasswordFormSchema } from "./schemas";

const GENERIC_INVALID = "Link inválido ou expirado.";
const checkPasswordRateLimit = createRateLimiter(8, 5 * 60 * 1000);
/** Edição de lista por link: folga pra quem mexe bastante, mas trava abuso (60 ações por minuto por link). */
const listEditRateLimit = createRateLimiter(60, 60 * 1000);

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
  if (!(await isShareLinkUnlocked(shareLink))) return fail("Não autenticado.");

  const { data: item } = await admin.from("items").select("content, title").eq("id", shareLink.resourceId).eq("owner_id", shareLink.ownerId).maybeSingle();
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

  await recordCheckActivity(admin, shareLink.ownerId, shareLink.id, shareLink.resourceId, item.title, checked, taskTextAtPath(currentContent, path));

  revalidatePath(`/p/${token}`);
  return ok(null);
}

/**
 * Permissão `edit` (07/10) — adicionar item, dar nota, marcar e editar/apagar só
 * o que a própria pessoa adicionou. Um link por pessoa: o nome do link (`label`)
 * é quem aparece nos itens e nas notas. Lê e grava o documento todo, com
 * comparação de `updated_at` pra duas pessoas mexendo ao mesmo tempo não se
 * sobrescreverem.
 */
export async function editSharedList(token: string, input: unknown, itemId?: string): Promise<Result<null>> {
  const parsed = listEditOpSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const admin = createAdminClient();
  const shareLink = await findShareLinkByTokenHash(admin, hashShareToken(token));
  if (!shareLink || !isShareLinkActive(shareLink)) return fail(GENERIC_INVALID);
  if (shareLink.permission !== "edit" || (shareLink.resourceType !== "item" && shareLink.resourceType !== "space")) {
    return fail("Essa ação não é permitida por esse link.");
  }
  if (!(await isShareLinkUnlocked(shareLink))) return fail("Não autenticado.");
  // Link de lista: o item é o do link. Link de espaço: qualquer lista do espaço (e da subcategoria, se houver) — conferido abaixo.
  const targetId = shareLink.resourceType === "item" ? shareLink.resourceId : (itemId ?? "");
  if (shareLink.resourceType === "space" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) return fail("Lista não encontrada.");
  const name = shareLink.label?.trim();
  if (!name) return fail("Esse link não tem um nome. Peça um novo link.");
  if (listEditRateLimit(shareLink.id)) return fail("Muitas ações seguidas. Espere um pouco e tente de novo.");

  let itemQuery = admin
    .from("items")
    .select("content, title, properties, updated_at, status, object_types(slug)")
    .eq("id", targetId)
    .eq("owner_id", shareLink.ownerId)
    .is("deleted_at", null);
  if (shareLink.resourceType === "space") itemQuery = itemQuery.eq("space_id", shareLink.resourceId);
  const { data: item } = await itemQuery.maybeSingle();
  if (!item || (shareLink.resourceType === "space" && item.status === "archived")) return fail("Item não encontrado.");
  if (shareLink.resourceType === "space" && shareLink.tagId) {
    const { data: tagged } = await admin.from("item_tags").select("item_id").eq("item_id", targetId).eq("tag_id", shareLink.tagId).maybeSingle();
    if (!tagged) return fail("Item não encontrado.");
  }
  const style = editableListStyle(item.object_types?.slug, item.properties as Record<string, unknown> | null);
  if (!style) return fail("Esse item não é mais uma lista.");

  const result = applyListEdit(item.content as unknown as JSONContent | null, style, { linkId: shareLink.id, name }, parsed.data);
  if (!result.ok) return fail(result.error);

  const { data: saved, error } = await admin
    .from("items")
    .update({ content: result.content as unknown as Json })
    .eq("id", targetId)
    .eq("owner_id", shareLink.ownerId)
    .eq("updated_at", item.updated_at)
    .select("id");
  if (error) return fail("Não foi possível salvar. Tente de novo.");
  if (!saved || saved.length === 0) return fail("A lista mudou enquanto você olhava. Atualizei — tente de novo.");

  await recordListActivity(admin, shareLink.ownerId, shareLink.id, targetId, item.title, name, result.kind, result.detail);

  revalidatePath(`/p/${token}`);
  if (shareLink.resourceType === "space") revalidatePath(`/p/${token}/i/${targetId}`);
  revalidatePath(`/itens/${targetId}`);
  return ok(null);
}

/** Mesmo molde de `recordCheckActivity`, mas com o nome de quem fez (link de edição). */
async function recordListActivity(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  shareLinkId: string,
  itemId: string,
  itemTitle: string,
  who: string,
  kind: "add" | "rate" | "edit" | "delete" | "check" | "uncheck",
  detail: string,
): Promise<void> {
  try {
    const since = new Date(Date.now() - CHECK_NOTIFY_WINDOW_MS).toISOString();
    const { data: recent } = await admin.from("share_link_events").select("id").eq("share_link_id", shareLinkId).gte("created_at", since).limit(1);
    await admin.from("share_link_events").insert({ owner_id: ownerId, share_link_id: shareLinkId, item_id: itemId, kind, detail: detail.slice(0, 500) });
    if ((recent ?? []).length > 0) return;
    const preferences = await getOwnerNotificationPreferences(admin, ownerId);
    if (!preferences.shareComments) return;
    await notifyOwner(ownerId, {
      title: "Mexeram numa lista que você compartilhou",
      text: `${who} mexeu em “${itemTitle || "Sem título"}” (última ação: ${detail.slice(0, 60)}).`,
    });
  } catch {
    // Aviso é melhor esforço.
  }
}

/** Um push por link a cada 10 min no máximo — quem marca a lista inteira do mercado não dispara um aviso por item. */
const CHECK_NOTIFY_WINDOW_MS = 10 * 60 * 1000;

/**
 * Aviso de marcação num link (9.7): registra em `share_link_events` (vira o
 * cartão "Nos seus links" no Hoje) e manda push pra dona se ela quer aviso
 * de atividade nos links e se não houve outro aviso desse link há pouco.
 * Falha aqui nunca desfaz a marcação — quem marcou não tem nada a ver com isso.
 */
async function recordCheckActivity(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  shareLinkId: string,
  itemId: string,
  itemTitle: string,
  checked: boolean,
  taskText: string | null,
): Promise<void> {
  try {
    const since = new Date(Date.now() - CHECK_NOTIFY_WINDOW_MS).toISOString();
    const { data: recent } = await admin.from("share_link_events").select("id").eq("share_link_id", shareLinkId).gte("created_at", since).limit(1);
    await admin.from("share_link_events").insert({
      owner_id: ownerId,
      share_link_id: shareLinkId,
      item_id: itemId,
      kind: checked ? "check" : "uncheck",
      detail: taskText,
    });
    if ((recent ?? []).length > 0) return;
    const preferences = await getOwnerNotificationPreferences(admin, ownerId);
    if (!preferences.shareComments) return;
    const what = taskText ? `“${taskText}”` : "um item";
    await notifyOwner(ownerId, {
      title: "Mexeram numa lista que você compartilhou",
      text: `${checked ? "Marcaram" : "Desmarcaram"} ${what} em “${itemTitle || "Sem título"}”.`,
    });
  } catch {
    // Aviso é melhor esforço.
  }
}

/** Permissão `comment` (3.11) — vira `share_comments` e, se configurado, um push pro dono (fecha a preferência deixada inerte na 3.9). */
export async function submitShareComment(token: string, input: { authorName: string; body: string }): Promise<Result<null>> {
  const parsed = shareCommentSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const admin = createAdminClient();
  const shareLink = await findShareLinkByTokenHash(admin, hashShareToken(token));
  if (!shareLink || !isShareLinkActive(shareLink)) return fail(GENERIC_INVALID);
  if (shareLink.permission !== "comment") return fail("Essa ação não é permitida por esse link.");
  if (!(await isShareLinkUnlocked(shareLink))) return fail("Não autenticado.");

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
  if (!(await isShareLinkUnlocked(shareLink))) return fail("Não autenticado.");

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
