"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emitTagAddedEvent } from "@/features/automations/lib/emit-item-event";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { TagOption } from "./queries";

const GENERIC_ERROR = "Não foi possível salvar a tag. Tente de novo.";
const UNIQUE_VIOLATION = "23505";

/**
 * Cria a tag (ou reaproveita a existente com o mesmo nome) e já anexa ao
 * item — usado pelo seletor de tags com criação inline (1.8).
 */
export async function addTagToItem(itemId: string, rawName: string): Promise<Result<TagOption | null>> {
  const name = rawName.trim().toLowerCase();
  if (!name) return fail("Nome de tag vazio.");
  if (name.length > 50) return fail("Nome de tag muito longo.");

  const { supabase, user } = await requireOwner();

  const { data: tag, error: tagError } = await supabase
    .from("tags")
    .upsert({ owner_id: user.id, name }, { onConflict: "owner_id,name" })
    .select("id, name, color")
    .single();
  if (tagError || !tag) return fail("Não foi possível criar a tag.");

  const { error: linkError } = await supabase
    .from("item_tags")
    .upsert({ item_id: itemId, tag_id: tag.id, owner_id: user.id }, { onConflict: "item_id,tag_id" });
  if (linkError) return fail("Não foi possível adicionar a tag ao item.");

  await emitTagAddedEvent({ ownerId: user.id, itemId, tag: name });

  revalidatePath(`/itens/${itemId}`);
  return ok(tag);
}

/** Taguear em lote (1.13, ação em lote do Inbox): cria/reaproveita a tag e anexa a vários itens de uma vez. */
export async function addTagToItems(itemIds: string[], rawName: string): Promise<Result<TagOption | null>> {
  const name = rawName.trim().toLowerCase();
  if (!name) return fail("Nome de tag vazio.");
  if (name.length > 50) return fail("Nome de tag muito longo.");
  if (itemIds.length === 0) return ok(null);

  const { supabase, user } = await requireOwner();

  const { data: tag, error: tagError } = await supabase
    .from("tags")
    .upsert({ owner_id: user.id, name }, { onConflict: "owner_id,name" })
    .select("id, name, color")
    .single();
  if (tagError || !tag) return fail("Não foi possível criar a tag.");

  const { error: linkError } = await supabase.from("item_tags").upsert(
    itemIds.map((itemId) => ({ item_id: itemId, tag_id: tag.id, owner_id: user.id })),
    { onConflict: "item_id,tag_id" },
  );
  if (linkError) return fail("Não foi possível adicionar a tag aos itens.");

  for (const itemId of itemIds) {
    await emitTagAddedEvent({ ownerId: user.id, itemId, tag: name });
  }

  revalidatePath("/inbox");
  return ok(tag);
}

export async function removeTagFromItem(itemId: string, tagId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("item_tags")
    .delete()
    .eq("item_id", itemId)
    .eq("tag_id", tagId)
    .eq("owner_id", user.id);
  if (error) return fail("Não foi possível remover a tag.");

  revalidatePath(`/itens/${itemId}`);
  return ok(null);
}

const renameSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à tag.").max(50),
  color: z.string().trim().max(30).optional(),
});

export async function renameTag(tagId: string, _prevState: Result<null>, formData: FormData): Promise<Result<null>> {
  const parsed = renameSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") ?? undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("tags")
    .update({ name: parsed.data.name.toLowerCase(), color: parsed.data.color || null })
    .eq("id", tagId)
    .eq("owner_id", user.id);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return fail("Já existe uma tag com esse nome.");
    return fail(GENERIC_ERROR);
  }

  revalidatePath("/configuracoes/tags");
  return ok(null);
}

export async function deleteTag(tagId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase.from("tags").delete().eq("id", tagId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível excluir a tag.");

  revalidatePath("/configuracoes/tags");
  return ok(null);
}

/** Move os itens da tag `fromTagId` para `toTagId` e exclui a primeira. */
export async function mergeTags(fromTagId: string, toTagId: string): Promise<Result<null>> {
  if (fromTagId === toTagId) return fail("Escolha duas tags diferentes.");

  const { supabase, user } = await requireOwner();

  const { data: fromLinks, error: readError } = await supabase
    .from("item_tags")
    .select("item_id")
    .eq("tag_id", fromTagId);
  if (readError) return fail("Não foi possível mesclar as tags.");

  if (fromLinks.length > 0) {
    const { error: upsertError } = await supabase.from("item_tags").upsert(
      fromLinks.map((link) => ({ item_id: link.item_id, tag_id: toTagId, owner_id: user.id })),
      { onConflict: "item_id,tag_id" },
    );
    if (upsertError) return fail("Não foi possível mesclar as tags.");
  }

  const { error: deleteError } = await supabase.from("tags").delete().eq("id", fromTagId).eq("owner_id", user.id);
  if (deleteError) return fail("Os itens foram movidos, mas não foi possível excluir a tag antiga.");

  revalidatePath("/configuracoes/tags");
  return ok(null);
}
