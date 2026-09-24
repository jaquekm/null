"use server";

import { revalidatePath } from "next/cache";
import { extractText } from "@/features/items/lib/extract-text";
import { markdownToTiptapDoc } from "@/features/items/lib/markdown-to-tiptap";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { MANUAL_DOCUMENTS } from "./lib/manual-documents";

const GENERIC_ERROR = "Não foi possível gerar o manual. Tente de novo.";
const HUB_SPACE_SLUG = "hub";

/**
 * Seed opcional (7.10) — cria (ou reescreve, se já existir) os 3 itens do
 * manual do sistema no espaço "Hub", tipo "Documento". Re-executável: acha
 * o item existente pelo título dentro do mesmo espaço/tipo e atualiza o
 * conteúdo em vez de duplicar — útil pra quando o texto do manual mudar
 * numa versão futura do app.
 */
export async function seedManual(): Promise<Result<{ itemIds: string[] }>> {
  const { supabase, user } = await requireOwner();

  const { data: space, error: spaceError } = await supabase
    .from("spaces")
    .upsert({ owner_id: user.id, name: "Hub", slug: HUB_SPACE_SLUG, icon: "BookOpen", position: 999 }, { onConflict: "owner_id,slug" })
    .select("id")
    .single();
  if (spaceError || !space) return fail(GENERIC_ERROR);

  const { data: documentType, error: typeError } = await supabase
    .from("object_types")
    .select("id")
    .eq("owner_id", user.id)
    .eq("slug", "documento")
    .maybeSingle();
  if (typeError) return fail(GENERIC_ERROR);
  if (!documentType) return fail('Tipo "Documento" ainda não existe — conclua a configuração inicial (onboarding) primeiro.');

  const itemIds: string[] = [];

  for (const doc of MANUAL_DOCUMENTS) {
    const content = markdownToTiptapDoc(doc.markdown);
    const contentText = extractText(content);

    const { data: existing, error: findError } = await supabase
      .from("items")
      .select("id")
      .eq("owner_id", user.id)
      .eq("space_id", space.id)
      .eq("type_id", documentType.id)
      .eq("title", doc.title)
      .is("deleted_at", null)
      .maybeSingle();
    if (findError) return fail(GENERIC_ERROR);

    if (existing) {
      const { error } = await supabase
        .from("items")
        .update({ content: content as unknown as Json, content_text: contentText })
        .eq("id", existing.id);
      if (error) return fail(GENERIC_ERROR);
      itemIds.push(existing.id);
    } else {
      const { data: inserted, error } = await supabase
        .from("items")
        .insert({
          owner_id: user.id,
          space_id: space.id,
          type_id: documentType.id,
          title: doc.title,
          status: "active",
          source: "automation",
          content: content as unknown as Json,
          content_text: contentText,
        })
        .select("id")
        .single();
      if (error || !inserted) return fail(GENERIC_ERROR);
      itemIds.push(inserted.id);
    }
  }

  revalidatePath("/configuracoes/manual");
  revalidatePath("/inbox");
  return ok({ itemIds });
}
