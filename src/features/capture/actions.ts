"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import { createCaptureItem } from "./lib/create-capture-item";
import { splitTitleAndBody } from "./lib/split-title-body";

/** Captura rápida dentro do app (diálogo ou `/capturar`) — 1.10. */
export async function capture(
  rawText: string,
  spaceId: string | null,
  typeId: string | null,
): Promise<Result<{ id: string } | null>> {
  const { title, body } = splitTitleAndBody(rawText);
  if (!title && !body) return fail("Escreva algo para capturar.");

  const { supabase, user } = await requireOwner();

  const result = await createCaptureItem(supabase, {
    ownerId: user.id,
    title: title || "Sem título",
    body,
    spaceId,
    typeId,
    source: "quick",
  });
  if (!result) return fail("Não foi possível capturar. Tente de novo.");

  revalidatePath("/inbox");
  return ok(result);
}
