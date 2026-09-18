"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { buildPropertiesSchema, type FieldDefinition } from "@/features/types/schemas";
import { remapProperties } from "./lib/remap-properties";

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

  revalidatePath(`/itens/${itemId}`);
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
    .select("properties, object_types(fields)")
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

  revalidatePath(`/itens/${itemId}`);
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

  const { error } = await supabase.from("items").update({ status: parsed.data }).eq("id", itemId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível atualizar o status.");

  revalidatePath(`/itens/${itemId}`);
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

  revalidatePath(`/itens/${parsed.data.parentId}`);
  redirect(`/itens/${data.id}`);
}
