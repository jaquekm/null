"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { fail, type Result } from "@/lib/result";
import { getObjectTypeBySlug } from "@/features/types/queries";
import { generateZettelId } from "./lib/generate-zettel-id";

/**
 * "+ Nota permanente" (5.11, Zettelkasten): gera o `id_zettel` na hora — o
 * motor de automações (5.3) não tem um token de template pra id único, e
 * estender o motor só por causa disso não vale a pena (mesmo princípio já
 * registrado na 5.5/5.7: função dedicada em vez de gatilho `item_created`).
 */
export async function createPermanentNote(spaceId: string | null): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const type = await getObjectTypeBySlug(supabase, "nota-permanente");
  if (!type) return fail('Tipo "Nota permanente" não encontrado — instale o pack PARA/Zettelkasten/GTD.');

  const idZettel = generateZettelId(new Date());
  const { data, error } = await supabase
    .from("items")
    .insert({
      owner_id: user.id,
      space_id: spaceId,
      type_id: type.id,
      title: `Nota ${idZettel}`,
      status: spaceId ? "active" : "inbox",
      properties: { id_zettel: idZettel },
    })
    .select("id")
    .single();

  if (error || !data) return fail("Não foi possível criar a nota permanente.");
  redirect(`/itens/${data.id}`);
}
