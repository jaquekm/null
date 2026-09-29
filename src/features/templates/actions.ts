"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { extractText } from "@/features/items/lib/extract-text";
import { addTagToItem } from "@/features/tags/actions";
import { requireOwner } from "@/lib/auth";
import { fail, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { findTemplate, normalizeSubcategory, templateIdSchema, templateProperties } from "./lib/templates";

const createFromTemplateSchema = z.object({
  templateId: templateIdSchema,
  spaceId: z.string().uuid(),
  title: z.string().trim().max(200).optional(),
  subcategory: z.string().max(80).optional(),
});

/**
 * "+ Novo" por modelo (9.2): cria o item já com tipo, tipo de lista,
 * conteúdo inicial e subcategoria (tag), e abre o item. O tipo é achado pelo
 * slug — de preferência o do próprio espaço, senão o global, senão qualquer
 * um da dona (tipos de pack ficam presos ao espaço onde o pack foi instalado).
 */
export async function createItemFromTemplate(_prev: Result<null>, formData: FormData): Promise<Result<null>> {
  const parsed = createFromTemplateSchema.safeParse({
    templateId: formData.get("templateId"),
    spaceId: formData.get("spaceId"),
    title: formData.get("title") ?? undefined,
    subcategory: formData.get("subcategory") ?? undefined,
  });
  if (!parsed.success) return fail("Não foi possível criar a partir do modelo.");
  const template = findTemplate(parsed.data.templateId);
  if (!template) return fail("Modelo não encontrado.");

  const { supabase, user } = await requireOwner();

  const { data: types, error: typesError } = await supabase
    .from("object_types")
    .select("id, space_id")
    .eq("slug", template.typeSlug)
    .is("archived_at", null);
  if (typesError) return fail("Não foi possível criar a partir do modelo.");
  const type = types.find((t) => t.space_id === parsed.data.spaceId) ?? types.find((t) => t.space_id === null) ?? types[0];
  if (!type) return fail(`O tipo "${template.label}" não está instalado. Veja em Configurações → Métodos.`);

  const content = template.content ?? null;
  const { data: item, error } = await supabase
    .from("items")
    .insert({
      owner_id: user.id,
      space_id: parsed.data.spaceId,
      type_id: type.id,
      title: parsed.data.title || template.defaultTitle,
      status: "active",
      properties: templateProperties(template) as Json,
      content: content as unknown as Json,
      content_text: content ? extractText(content) : "",
    })
    .select("id")
    .single();
  if (error || !item) return fail("Não foi possível criar a partir do modelo.");

  const subcategory = normalizeSubcategory(parsed.data.subcategory);
  // Falhar a subcategoria não desfaz o item — ela pode ser posta depois na página do item.
  if (subcategory) await addTagToItem(item.id, subcategory);

  redirect(`/itens/${item.id}`);
}
