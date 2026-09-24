import "server-only";
import type { JSONContent } from "@tiptap/core";
import type { z } from "zod";
import { enqueueIndexItem } from "@/features/ai/lib/enqueue-index";
import { emitItemEvent } from "@/features/automations/lib/emit-item-event";
import { createCaptureItem } from "@/features/capture/lib/create-capture-item";
import { diffLinks } from "@/features/items/lib/diff-links";
import { extractMentionIds } from "@/features/items/lib/extract-mention-ids";
import { extractText } from "@/features/items/lib/extract-text";
import { markdownToTiptapDoc } from "@/features/items/lib/markdown-to-tiptap";
import { syncContactMentions } from "@/features/items/lib/sync-contact-mentions";
import { buildPropertiesSchema, type FieldDefinition } from "@/features/types/schemas";
import type { Json } from "@/lib/supabase/database.types";
import type { appendToItemInput, createItemInput, createReminderForMeInput, updatePropertiesInput } from "../schemas";
import type { AdminClient, McpContext } from "../types";

type Infer<T extends z.ZodRawShape> = z.infer<z.ZodObject<T>>;

async function resolveTypeId(admin: AdminClient, ownerId: string, nameOrSlug: string): Promise<string | null> {
  const bySlug = await admin.from("object_types").select("id").eq("owner_id", ownerId).ilike("slug", nameOrSlug).maybeSingle();
  if (bySlug.data) return bySlug.data.id;
  const byName = await admin.from("object_types").select("id").eq("owner_id", ownerId).ilike("name", nameOrSlug).maybeSingle();
  return byName.data?.id ?? null;
}

async function resolveSpaceId(admin: AdminClient, ownerId: string, slug: string): Promise<string | null> {
  const { data } = await admin.from("spaces").select("id").eq("owner_id", ownerId).eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

export interface CreateItemResult {
  id: string;
  url: string;
}

/**
 * `create_item` (mcp:write) — reaproveita `createCaptureItem` (1.10, já
 * roda com cliente admin: sem espaço vai pro inbox, com anexa `#tags` do
 * texto), depois resolve tipo/espaço/tags/propriedades por cima.
 */
export async function mcpCreateItem(ctx: McpContext, input: Infer<typeof createItemInput>): Promise<CreateItemResult | { error: string }> {
  const { admin, ownerId } = ctx;

  const [spaceId, typeId] = await Promise.all([
    input.space ? resolveSpaceId(admin, ownerId, input.space) : Promise.resolve(null),
    input.type ? resolveTypeId(admin, ownerId, input.type) : Promise.resolve(null),
  ]);
  if (input.space && !spaceId) return { error: `Espaço "${input.space}" não encontrado.` };
  if (input.type && !typeId) return { error: `Tipo "${input.type}" não encontrado.` };

  const body = input.contentMarkdown ?? "";
  const created = await createCaptureItem(admin, {
    ownerId,
    title: input.title,
    body,
    spaceId,
    typeId,
    source: "mcp",
  });
  if (!created) return { error: "Não foi possível criar o item." };

  if (input.contentMarkdown) {
    const doc = markdownToTiptapDoc(input.contentMarkdown);
    await admin.from("items").update({ content: doc as unknown as Json, content_text: extractText(doc) }).eq("id", created.id);
  }

  if (input.tags && input.tags.length > 0) {
    for (const rawName of input.tags) {
      const name = rawName.trim().toLowerCase();
      if (!name) continue;
      const { data: tag } = await admin.from("tags").upsert({ owner_id: ownerId, name }, { onConflict: "owner_id,name" }).select("id").single();
      if (tag) await admin.from("item_tags").upsert({ item_id: created.id, tag_id: tag.id, owner_id: ownerId }, { onConflict: "item_id,tag_id" });
    }
  }

  if (input.properties && typeId) {
    const applied = await applyProperties(admin, ownerId, created.id, typeId, input.properties);
    if ("error" in applied) return applied;
  }

  await enqueueIndexItem(ownerId, created.id);
  return { id: created.id, url: `/itens/${created.id}` };
}

/** Compartilhado por `create_item`/`update_properties` — valida campo a campo (mesmo padrão de `updateItemProperty`, 1.6), pra um campo desconhecido não derrubar os demais. */
async function applyProperties(
  admin: AdminClient,
  ownerId: string,
  itemId: string,
  typeId: string,
  properties: Record<string, unknown>,
): Promise<{ ok: true; updatedAt: string } | { error: string }> {
  const { data: type } = await admin.from("object_types").select("fields").eq("id", typeId).maybeSingle();
  const fields = (type?.fields as unknown as FieldDefinition[] | null) ?? [];

  const { data: item } = await admin.from("items").select("status, properties").eq("id", itemId).maybeSingle();
  if (!item) return { error: "Item não encontrado." };
  const currentProperties = (item.properties as Record<string, unknown> | null) ?? {};
  const nextProperties = { ...currentProperties };

  for (const [key, rawValue] of Object.entries(properties)) {
    const field = fields.find((f) => f.key === key);
    if (!field) return { error: `Campo "${key}" não encontrado neste tipo.` };
    const schema = buildPropertiesSchema([field]);
    const parsed = schema.safeParse({ [key]: rawValue });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? `Valor inválido para "${key}".` };
    Object.assign(nextProperties, parsed.data);
  }

  const { data, error } = await admin.from("items").update({ properties: nextProperties as unknown as Json }).eq("id", itemId).eq("owner_id", ownerId).select("updated_at").single();
  if (error || !data) return { error: "Não foi possível salvar as propriedades." };

  await emitItemEvent({ ownerId, itemId, before: { status: item.status, properties: currentProperties }, after: { status: item.status, properties: nextProperties } });
  return { ok: true, updatedAt: data.updated_at };
}

/** `update_properties` (mcp:write). */
export async function mcpUpdateProperties(ctx: McpContext, input: Infer<typeof updatePropertiesInput>): Promise<{ ok: true } | { error: string }> {
  const { admin, ownerId } = ctx;
  const { data: item } = await admin.from("items").select("type_id").eq("id", input.id).eq("owner_id", ownerId).maybeSingle();
  if (!item) return { error: "Item não encontrado." };
  if (!item.type_id) return { error: "Este item não tem um tipo — não há campos pra validar." };

  const result = await applyProperties(admin, ownerId, input.id, item.type_id, input.properties);
  if ("error" in result) return result;

  await enqueueIndexItem(ownerId, input.id);
  return { ok: true };
}

/**
 * `append_to_item` (mcp:write) — acrescenta o Markdown (convertido via
 * `markdownToTiptapDoc`) ao final do `content` atual, mesma sincronização de
 * `links`/`item_contacts` de `updateItemContent` (1.7/3.3). "Cria versão
 * antes" do enunciado já acontece sozinho: o trigger `items_version_snapshot`
 * (migration `nucleo`) tira o snapshot em qualquer `UPDATE` de `items` que
 * mude `content`, no máximo 1 a cada 10 min por item — não precisa replicar
 * isso aqui.
 */
export async function mcpAppendToItem(ctx: McpContext, input: Infer<typeof appendToItemInput>): Promise<{ ok: true } | { error: string }> {
  const { admin, ownerId } = ctx;

  const { data: item } = await admin.from("items").select("content").eq("id", input.id).eq("owner_id", ownerId).maybeSingle();
  if (!item) return { error: "Item não encontrado." };

  const existingDoc = (item.content as unknown as JSONContent | null) ?? { type: "doc", content: [] };
  const appended = markdownToTiptapDoc(input.contentMarkdown);
  const nextDoc: JSONContent = { type: "doc", content: [...(existingDoc.content ?? []), ...(appended.content ?? [])] };

  const { data: existingLinks } = await admin.from("links").select("target_id").eq("source_id", input.id).eq("kind", "mention");
  const currentMentionIds = (existingLinks ?? []).map((l) => l.target_id);
  const nextMentionIds = extractMentionIds(nextDoc);
  const { add, remove } = diffLinks(currentMentionIds, nextMentionIds);

  const { error } = await admin.from("items").update({ content: nextDoc as unknown as Json, content_text: extractText(nextDoc) }).eq("id", input.id).eq("owner_id", ownerId);
  if (error) return { error: "Não foi possível salvar o conteúdo." };

  if (remove.length > 0) await admin.from("links").delete().eq("source_id", input.id).eq("kind", "mention").in("target_id", remove);
  if (add.length > 0) await admin.from("links").insert(add.map((targetId) => ({ owner_id: ownerId, source_id: input.id, target_id: targetId, kind: "mention" })));

  await syncContactMentions(admin, ownerId, input.id, nextDoc);
  await enqueueIndexItem(ownerId, input.id);

  return { ok: true };
}

export interface CreateReminderResult {
  id: string;
}

/** `create_reminder_for_me` (mcp:write) — só pro dono, sem recorrência (o cliente MCP manda um instante fixo em `when`). */
export async function mcpCreateReminderForMe(ctx: McpContext, input: Infer<typeof createReminderForMeInput>): Promise<CreateReminderResult | { error: string }> {
  const { admin, ownerId, timezone } = ctx;
  const sendAt = new Date(input.when);
  if (Number.isNaN(sendAt.getTime())) return { error: "Data/hora inválida em 'when'." };

  const { data, error } = await admin
    .from("reminders")
    .insert({
      owner_id: ownerId,
      title: input.title,
      message_template: input.message ?? input.title,
      channel: "push",
      recipient_type: "me",
      contact_ids: [],
      send_at: sendAt.toISOString(),
      rrule: null,
      timezone,
      variables: {},
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível criar o lembrete." };

  return { id: data.id };
}
