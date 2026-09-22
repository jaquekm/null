"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { JSONContent } from "@tiptap/core";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { buildPropertiesSchema, type FieldDefinition } from "@/features/types/schemas";
import { removeItemAttachmentsFromStorage } from "@/features/attachments/actions";
import { emitItemEvent } from "@/features/automations/lib/emit-item-event";
import { attachHashtagsFromText } from "@/features/tags/lib/attach-hashtags";
import { positionBetween } from "@/features/spaces/lib/position";
import { diffLinks } from "./lib/diff-links";
import { extractMentionIds } from "./lib/extract-mention-ids";
import { extractText } from "./lib/extract-text";
import { remapProperties } from "./lib/remap-properties";
import { syncContactMentions } from "./lib/sync-contact-mentions";
import { getItemVersion, type ItemVersionDetail } from "./queries";

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";
const CONFLICT_ERROR = "Este item foi alterado em outro dispositivo.";
const CONFLICT_FIELD_ERRORS = { _conflict: ["true"] };

/**
 * Checa o controle de concorrência simples da 1.6: o cliente manda o
 * `updated_at` que tinha quando carregou o item; se o banco já tiver um
 * mais novo, é porque alguém (ou outra aba) mudou o item no meio do
 * caminho — devolve conflito em vez de sobrescrever silenciosamente.
 */
async function checkNotStale(
  supabase: Awaited<ReturnType<typeof requireOwner>>["supabase"],
  itemId: string,
  knownUpdatedAt: string,
): Promise<Result<never> | null> {
  const { data, error } = await supabase.from("items").select("updated_at").eq("id", itemId).maybeSingle();
  if (error || !data) return fail("Item não encontrado.");
  if (data.updated_at !== knownUpdatedAt) return fail(CONFLICT_ERROR, CONFLICT_FIELD_ERRORS);
  return null;
}

export async function updateItemTitle(
  itemId: string,
  knownUpdatedAt: string,
  _prevState: Result<{ updatedAt: string } | null>,
  formData: FormData,
): Promise<Result<{ updatedAt: string } | null>> {
  const title = String(formData.get("title") ?? "").slice(0, 500);

  const { supabase, user } = await requireOwner();

  const conflict = await checkNotStale(supabase, itemId, knownUpdatedAt);
  if (conflict) return conflict;

  const { data, error } = await supabase
    .from("items")
    .update({ title })
    .eq("id", itemId)
    .eq("owner_id", user.id)
    .select("updated_at")
    .single();

  if (error || !data) return fail(GENERIC_ERROR);

  await attachHashtagsFromText(supabase, user.id, itemId, title);

  // Sem `revalidatePath` de propósito: isto salva a cada perda de foco do título (autosave "vivo"),
  // e o `ItemEditor` já se atualiza sozinho via `onSaved`/`updatedAt` — revalidar aqui forçaria a página
  // a buscar dados de novo a cada salvamento, trocando a `key` do editor (`page.tsx`) e remontando-o no
  // meio da digitação (perde o cursor). `restoreItemVersion`, que muda o conteúdo por fora do editor,
  // continua revalidando — é o caso que realmente precisa da remontagem.
  return ok({ updatedAt: data.updated_at });
}

function parseRawFieldValue(field: FieldDefinition, raw: FormDataEntryValue | null): unknown {
  switch (field.type) {
    case "checkbox":
      return raw === "on" || raw === "true";
    case "number":
    case "percent":
    case "rating":
    case "money":
    case "duration":
      if (raw === null || raw === "") return undefined;
      return Number(raw);
    case "multi_select": {
      if (typeof raw !== "string" || !raw) return [];
      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    default:
      return typeof raw === "string" && raw !== "" ? raw : undefined;
  }
}

export async function updateItemProperty(
  itemId: string,
  fieldKey: string,
  knownUpdatedAt: string,
  _prevState: Result<{ updatedAt: string } | null>,
  formData: FormData,
): Promise<Result<{ updatedAt: string } | null>> {
  const { supabase, user } = await requireOwner();

  const conflict = await checkNotStale(supabase, itemId, knownUpdatedAt);
  if (conflict) return conflict;

  const { data: item, error: readError } = await supabase
    .from("items")
    .select("status, properties, object_types(fields)")
    .eq("id", itemId)
    .maybeSingle();
  if (readError || !item) return fail("Item não encontrado.");

  const fields = (item.object_types?.fields as unknown as FieldDefinition[] | null) ?? [];
  const field = fields.find((f) => f.key === fieldKey);
  if (!field) return fail("Campo não encontrado neste tipo.");

  const rawValue = parseRawFieldValue(field, formData.get("value"));
  const schema = buildPropertiesSchema([field]);
  const parsed = schema.safeParse({ [fieldKey]: rawValue });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const currentProperties = (item.properties as Record<string, unknown> | null) ?? {};
  const nextProperties = { ...currentProperties, ...parsed.data };

  const { data, error } = await supabase
    .from("items")
    .update({ properties: nextProperties as unknown as Json })
    .eq("id", itemId)
    .eq("owner_id", user.id)
    .select("updated_at")
    .single();

  if (error || !data) return fail(GENERIC_ERROR);

  await emitItemEvent({
    ownerId: user.id,
    itemId,
    before: { status: item.status, properties: currentProperties },
    after: { status: item.status, properties: nextProperties },
  });

  // Sem `revalidatePath` de propósito — mesmo motivo de `updateItemTitle`: autosave por campo,
  // o `PropertiesPanel` já se atualiza sozinho via `onSaved`/`updatedAt`.
  return ok({ updatedAt: data.updated_at });
}

export async function moveItem(itemId: string, spaceId: string | null): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("items")
    .update({ space_id: spaceId })
    .eq("id", itemId)
    .eq("owner_id", user.id);

  if (error) return fail("Não foi possível mover o item.");

  revalidatePath(`/itens/${itemId}`);
  return ok(null);
}

/**
 * Mover em lote, usada só pelo Inbox (1.13; um item só ou vários de uma vez) — ao
 * contrário de `moveItem` (página do item, 1.6), aqui definir um espaço também tira o
 * item do inbox (`status` vira `active`). `moveItem` não muda status: mover um item já
 * ativo (ou arquivado) de espaço pela página do item não deve reativá-lo sozinho.
 */
export async function moveItems(itemIds: string[], spaceId: string | null): Promise<Result<null>> {
  if (itemIds.length === 0) return ok(null);
  const { supabase, user } = await requireOwner();

  const updates: { space_id: string | null; status?: "active" } = spaceId
    ? { space_id: spaceId, status: "active" }
    : { space_id: spaceId };

  const { error } = await supabase.from("items").update(updates).in("id", itemIds).eq("owner_id", user.id);
  if (error) return fail("Não foi possível mover os itens.");

  revalidatePath("/inbox");
  return ok(null);
}

export async function archiveItems(itemIds: string[]): Promise<Result<null>> {
  if (itemIds.length === 0) return ok(null);
  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("items")
    .update({ status: "archived" })
    .in("id", itemIds)
    .eq("owner_id", user.id);
  if (error) return fail("Não foi possível arquivar os itens.");

  revalidatePath("/inbox");
  return ok(null);
}

/** Exclusão em lote, sem redirecionar — ao contrário de `softDeleteItem`, usada na página do item. */
export async function softDeleteItems(itemIds: string[]): Promise<Result<null>> {
  if (itemIds.length === 0) return ok(null);
  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", itemIds)
    .eq("owner_id", user.id);
  if (error) return fail("Não foi possível excluir os itens.");

  revalidatePath("/inbox");
  return ok(null);
}

/** Reordenar dentro de uma coluna do Kanban (1.15) — mesmo padrão de `reorderSpace` (1.3). */
export async function reorderItem(
  itemId: string,
  beforePosition: number | null,
  afterPosition: number | null,
): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const position = positionBetween(beforePosition, afterPosition);

  const { error } = await supabase.from("items").update({ position }).eq("id", itemId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível reordenar os itens.");

  return ok(null);
}

export async function changeItemType(itemId: string, typeId: string | null): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { data: item, error: readError } = await supabase
    .from("items")
    .select("properties")
    .eq("id", itemId)
    .maybeSingle();
  if (readError || !item) return fail("Item não encontrado.");

  let newFieldKeys: string[] = [];
  if (typeId) {
    const { data: type, error: typeError } = await supabase
      .from("object_types")
      .select("fields")
      .eq("id", typeId)
      .maybeSingle();
    if (typeError || !type) return fail("Tipo não encontrado.");
    newFieldKeys = ((type.fields as unknown as FieldDefinition[] | null) ?? []).map((f) => f.key);
  }

  const currentProperties = (item.properties as Record<string, unknown> | null) ?? {};
  const nextProperties = remapProperties(currentProperties, newFieldKeys);

  const { error } = await supabase
    .from("items")
    .update({ type_id: typeId, properties: nextProperties as unknown as Json })
    .eq("id", itemId)
    .eq("owner_id", user.id);

  if (error) return fail("Não foi possível mudar o tipo.");

  revalidatePath(`/itens/${itemId}`);
  revalidatePath("/inbox");
  return ok(null);
}

export async function duplicateItem(itemId: string): Promise<Result<{ id: string } | null>> {
  const { supabase, user } = await requireOwner();

  const { data: original, error: readError } = await supabase
    .from("items")
    .select("space_id, type_id, title, content, content_text, properties, icon")
    .eq("id", itemId)
    .maybeSingle();
  if (readError || !original) return fail("Item não encontrado.");

  const { data, error } = await supabase
    .from("items")
    .insert({
      owner_id: user.id,
      space_id: original.space_id,
      type_id: original.type_id,
      title: `${original.title} (cópia)`,
      content: original.content,
      content_text: original.content_text,
      properties: original.properties,
      icon: original.icon,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) return fail("Não foi possível duplicar o item.");

  revalidatePath(`/itens/${itemId}`);
  return ok({ id: data.id });
}

export async function togglePin(itemId: string, pinned: boolean): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase.from("items").update({ pinned }).eq("id", itemId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível atualizar o item.");

  revalidatePath(`/itens/${itemId}`);
  return ok(null);
}

const itemStatusSchema = z.enum(["inbox", "active", "archived"]);

export async function setItemStatus(itemId: string, status: string): Promise<Result<null>> {
  const parsed = itemStatusSchema.safeParse(status);
  if (!parsed.success) return fail(GENERIC_ERROR);

  const { supabase, user } = await requireOwner();

  const { data: current } = await supabase.from("items").select("status, properties").eq("id", itemId).maybeSingle();

  const { error } = await supabase.from("items").update({ status: parsed.data }).eq("id", itemId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível atualizar o status.");

  if (current) {
    const properties = (current.properties as Record<string, unknown> | null) ?? {};
    await emitItemEvent({
      ownerId: user.id,
      itemId,
      before: { status: current.status, properties },
      after: { status: parsed.data, properties },
    });
  }

  revalidatePath(`/itens/${itemId}`);
  revalidatePath("/inbox");
  return ok(null);
}

export async function softDeleteItem(itemId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("owner_id", user.id);

  if (error) return fail("Não foi possível excluir o item.");

  revalidatePath("/inbox");
  redirect("/inbox");
}

export async function restoreItem(itemId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase.from("items").update({ deleted_at: null }).eq("id", itemId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível restaurar o item.");

  revalidatePath("/configuracoes/lixeira");
  return ok(null);
}

export async function permanentlyDeleteItem(itemId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  await removeItemAttachmentsFromStorage(supabase, itemId);

  const { error } = await supabase.from("items").delete().eq("id", itemId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível excluir o item definitivamente.");

  revalidatePath("/configuracoes/lixeira");
  return ok(null);
}

const newSubitemSchema = z.object({
  parentId: z.string().uuid(),
  spaceId: z.string().uuid().nullable(),
  title: z.string().trim().max(200).optional(),
});

export async function createSubitem(_prevState: Result<null>, formData: FormData): Promise<Result<null>> {
  const parsed = newSubitemSchema.safeParse({
    parentId: formData.get("parentId"),
    spaceId: formData.get("spaceId") || null,
    title: formData.get("title") || undefined,
  });
  if (!parsed.success) return fail("Não foi possível criar o subitem.");

  const { supabase, user } = await requireOwner();

  const { data, error } = await supabase
    .from("items")
    .insert({
      owner_id: user.id,
      parent_id: parsed.data.parentId,
      space_id: parsed.data.spaceId,
      title: parsed.data.title ?? "",
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) return fail("Não foi possível criar o subitem.");

  await emitItemEvent({ ownerId: user.id, itemId: data.id, before: null, after: { status: "active", properties: {} } });

  revalidatePath(`/itens/${parsed.data.parentId}`);
  redirect(`/itens/${data.id}`);
}

/**
 * Salva o corpo do item (editor Tiptap, 1.7): `content`, `content_text`
 * (via `extractText`) e sincroniza `links` (`kind = 'mention'`) de acordo
 * com `diffLinks` entre os ids de menção atuais e os novos.
 */
export async function updateItemContent(
  itemId: string,
  knownUpdatedAt: string,
  content: JSONContent,
): Promise<Result<{ updatedAt: string } | null>> {
  const { supabase, user } = await requireOwner();

  const conflict = await checkNotStale(supabase, itemId, knownUpdatedAt);
  if (conflict) return conflict;

  const { data: existingLinks, error: linksReadError } = await supabase
    .from("links")
    .select("target_id")
    .eq("source_id", itemId)
    .eq("kind", "mention");
  if (linksReadError) return fail(GENERIC_ERROR);

  const currentMentionIds = existingLinks.map((l) => l.target_id);
  const nextMentionIds = extractMentionIds(content);
  const { add, remove } = diffLinks(currentMentionIds, nextMentionIds);

  const { data, error } = await supabase
    .from("items")
    .update({
      content: content as unknown as Json,
      content_text: extractText(content),
    })
    .eq("id", itemId)
    .eq("owner_id", user.id)
    .select("updated_at")
    .single();

  if (error || !data) return fail(GENERIC_ERROR);

  if (remove.length > 0) {
    await supabase.from("links").delete().eq("source_id", itemId).eq("kind", "mention").in("target_id", remove);
  }
  if (add.length > 0) {
    await supabase.from("links").insert(
      add.map((targetId) => ({
        owner_id: user.id,
        source_id: itemId,
        target_id: targetId,
        kind: "mention",
      })),
    );
  }
  await syncContactMentions(supabase, user.id, itemId, content);

  // Sem `revalidatePath` de propósito — mesmo motivo de `updateItemTitle`: chamado a cada
  // ~800ms enquanto o dono digita (debounce do Tiptap), o `ItemContentEditor` já se atualiza
  // sozinho via `onSaved`/`updatedAt`. Revalidar aqui era o bug real: a página buscava dados
  // de novo a cada salvamento, trocando a `key` do `ItemEditor` (`page.tsx`) e remontando o
  // editor no meio da digitação — perdia o cursor a cada letra.
  return ok({ updatedAt: data.updated_at });
}

export interface MentionSearchResult {
  id: string;
  title: string;
}

/** Busca itens para o menu de menção `[[` do editor (1.7), via `search_items`. */
export async function searchItemsForMention(query: string): Promise<MentionSearchResult[]> {
  if (!query.trim()) return [];

  const { supabase } = await requireOwner();
  const { data, error } = await supabase.rpc("search_items", { q: query, p_limit: 8 });
  if (error || !data) return [];

  return data.map((row) => ({ id: row.id, title: row.title }));
}

/**
 * Cria um item a partir do editor ("Criar item '&lt;texto&gt;'" no menu de
 * menção `[[`, 1.7) — não redireciona, ao contrário de `createItemInSpace`.
 */
export async function createItemForMention(
  title: string,
  spaceId: string | null,
): Promise<Result<MentionSearchResult | null>> {
  const trimmed = title.trim();
  if (!trimmed) return fail("Título vazio.");

  const { supabase, user } = await requireOwner();

  const { data, error } = await supabase
    .from("items")
    .insert({ owner_id: user.id, space_id: spaceId, title: trimmed, status: "active" })
    .select("id, title")
    .single();

  if (error || !data) return fail("Não foi possível criar o item.");

  return ok({ id: data.id, title: data.title });
}

/** Conteúdo completo de uma versão, buscado sob demanda ao abrir o diálogo de visualização/comparação (1.17). */
export async function getItemVersionDetail(itemId: string, versionId: string): Promise<ItemVersionDetail | null> {
  const { supabase } = await requireOwner();
  return getItemVersion(supabase, itemId, versionId);
}

/** "Salvar versão agora" (1.17): snapshot manual do estado atual, com rótulo opcional. */
export async function saveItemVersionNow(itemId: string, label: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { data: item, error: readError } = await supabase
    .from("items")
    .select("title, content, properties")
    .eq("id", itemId)
    .maybeSingle();
  if (readError || !item) return fail("Item não encontrado.");

  const { error } = await supabase.from("item_versions").insert({
    owner_id: user.id,
    item_id: itemId,
    title: item.title,
    content: item.content,
    properties: item.properties,
    reason: "manual",
    label: label.trim() || null,
  });
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(`/itens/${itemId}`);
  return ok(null);
}

/**
 * Restaurar uma versão (1.17): salva o estado atual como uma versão nova
 * (`reason = 'restore'`, uma rede de segurança pra desfazer a própria
 * restauração) e só então aplica título/conteúdo/propriedades da versão
 * escolhida — mesmo reconciliamento de menções que `updateItemContent` faz,
 * já que o conteúdo restaurado pode ter `[[menções]]` diferentes do atual.
 */
export async function restoreItemVersion(itemId: string, versionId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const [{ data: current, error: currentError }, { data: target, error: targetError }] = await Promise.all([
    supabase.from("items").select("title, content, properties").eq("id", itemId).maybeSingle(),
    supabase.from("item_versions").select("title, content, properties").eq("id", versionId).eq("item_id", itemId).maybeSingle(),
  ]);
  if (currentError || !current) return fail("Item não encontrado.");
  if (targetError || !target) return fail("Versão não encontrada.");

  const { error: snapshotError } = await supabase.from("item_versions").insert({
    owner_id: user.id,
    item_id: itemId,
    title: current.title,
    content: current.content,
    properties: current.properties,
    reason: "restore",
  });
  if (snapshotError) return fail(GENERIC_ERROR);

  const targetContent = (target.content as unknown as JSONContent | null) ?? null;

  const { data: existingLinks, error: linksReadError } = await supabase
    .from("links")
    .select("target_id")
    .eq("source_id", itemId)
    .eq("kind", "mention");
  if (linksReadError) return fail(GENERIC_ERROR);

  const currentMentionIds = existingLinks.map((l) => l.target_id);
  const nextMentionIds = extractMentionIds(targetContent);
  const { add, remove } = diffLinks(currentMentionIds, nextMentionIds);

  const { error } = await supabase
    .from("items")
    .update({
      title: target.title,
      content: target.content,
      content_text: extractText(targetContent),
      properties: target.properties,
    })
    .eq("id", itemId)
    .eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  if (remove.length > 0) {
    await supabase.from("links").delete().eq("source_id", itemId).eq("kind", "mention").in("target_id", remove);
  }
  if (add.length > 0) {
    await supabase.from("links").insert(
      add.map((targetId) => ({
        owner_id: user.id,
        source_id: itemId,
        target_id: targetId,
        kind: "mention",
      })),
    );
  }
  await syncContactMentions(supabase, user.id, itemId, targetContent);

  await attachHashtagsFromText(supabase, user.id, itemId, target.title);

  revalidatePath(`/itens/${itemId}`);
  return ok(null);
}
