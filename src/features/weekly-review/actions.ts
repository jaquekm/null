"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { fail, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { extractText } from "@/features/items/lib/extract-text";
import { getObjectTypeBySlug } from "@/features/types/queries";
import { buildReviewSummaryDoc } from "./lib/build-review-summary";
import { formatWeekLabel } from "./lib/week-label";
import { getWeeklyReviewData } from "./queries";

/**
 * "Concluir revisão" (5.8): re-busca os 6 passos (evita transportar tudo em
 * campos ocultos do formulário) e salva o resumo como um item "Nota"
 * (`Revisão semanal AAAA-SS`) com as notas livres que o dono escreveu.
 */
export async function saveWeeklyReview(_prevState: Result<{ id: string }>, formData: FormData): Promise<Result<{ id: string }>> {
  const notes = String(formData.get("notes") ?? "").trim();

  const { supabase, user } = await requireOwner();

  const notaType = await getObjectTypeBySlug(supabase, "nota");
  if (!notaType) return fail("Tipo de sistema \"Nota\" não encontrado.");

  const data = await getWeeklyReviewData(supabase, user.id);
  const content = { type: "doc", content: buildReviewSummaryDoc({ ...data, notes }) };
  const title = `Revisão semanal ${formatWeekLabel(data.dateStr)}`;

  const { data: created, error } = await supabase
    .from("items")
    .insert({
      owner_id: user.id,
      title,
      type_id: notaType.id,
      status: "active",
      content: content as unknown as Json,
      content_text: extractText(content),
    })
    .select("id")
    .single();

  if (error || !created) return fail("Não foi possível salvar a revisão semanal.");

  redirect(`/itens/${created.id}`);
}
