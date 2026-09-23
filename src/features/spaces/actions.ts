"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import { slugify } from "@/lib/slugify";
import { positionBetween } from "./lib/position";
import { countActiveItemsInSpace } from "./queries";
import { spaceInputSchema } from "./schemas";

const GENERIC_ERROR = "Não foi possível salvar o espaço. Tente de novo.";
const UNIQUE_VIOLATION = "23505";

function toRow(input: z.infer<typeof spaceInputSchema>) {
  return {
    name: input.name,
    icon: input.icon || null,
    color: input.color || null,
    description: input.description || null,
  };
}

export async function createSpace(
  _prevState: Result<{ slug: string } | null>,
  formData: FormData,
): Promise<Result<{ slug: string } | null>> {
  const parsed = spaceInputSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") ?? undefined,
    color: formData.get("color") ?? undefined,
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR, parsed.error.flatten().fieldErrors);
  }

  const { supabase, user } = await requireOwner();

  const { data: last } = await supabase
    .from("spaces")
    .select("position")
    .eq("owner_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const slug = slugify(parsed.data.name) || `espaco-${Date.now()}`;
  const position = positionBetween(last?.position ?? null, null);

  const { error } = await supabase.from("spaces").insert({
    owner_id: user.id,
    slug,
    position,
    ...toRow(parsed.data),
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return fail("Já existe um espaço com esse nome.", { name: ["Já existe um espaço com esse nome."] });
    }
    return fail(GENERIC_ERROR);
  }

  revalidatePath("/", "layout");
  return ok({ slug });
}

export async function updateSpace(spaceId: string, _prevState: Result<null>, formData: FormData): Promise<Result<null>> {
  const parsed = spaceInputSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") ?? undefined,
    color: formData.get("color") ?? undefined,
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR, parsed.error.flatten().fieldErrors);
  }

  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("spaces")
    .update(toRow(parsed.data))
    .eq("id", spaceId)
    .eq("owner_id", user.id);

  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/", "layout");
  return ok(null);
}

export async function setSpaceArchived(spaceId: string, archived: boolean): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("spaces")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", spaceId)
    .eq("owner_id", user.id);

  if (error) return fail("Não foi possível atualizar o espaço.");

  revalidatePath("/", "layout");
  return ok(null);
}

/** "Quais espaços são indexados" (6.5, `/configuracoes/ia`) — `spaces.ai_enabled` já existia desde a fundação (lido em `assertAiAllowed`), mas nenhuma tela editava até aqui. */
export async function setSpaceAiEnabled(spaceId: string, enabled: boolean): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase.from("spaces").update({ ai_enabled: enabled }).eq("id", spaceId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível atualizar o espaço.");

  revalidatePath("/configuracoes/ia");
  return ok(null);
}

export async function reorderSpace(
  spaceId: string,
  beforePosition: number | null,
  afterPosition: number | null,
): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const position = positionBetween(beforePosition, afterPosition);

  const { error } = await supabase
    .from("spaces")
    .update({ position })
    .eq("id", spaceId)
    .eq("owner_id", user.id);

  if (error) return fail("Não foi possível reordenar os espaços.");

  revalidatePath("/", "layout");
  return ok(null);
}

/**
 * Só exclui se o espaço estiver vazio. Se não estiver, o chamador deve
 * oferecer mover os itens para outro espaço (`moveItemsAndDeleteSpace`).
 */
export async function deleteSpace(spaceId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const itemCount = await countActiveItemsInSpace(supabase, spaceId);
  if (itemCount > 0) {
    return fail(
      `Este espaço tem ${itemCount} ${itemCount === 1 ? "item" : "itens"}. Mova os itens para outro espaço antes de excluir.`,
    );
  }

  const { error } = await supabase.from("spaces").delete().eq("id", spaceId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível excluir o espaço.");

  revalidatePath("/", "layout");
  redirect("/inbox");
}

export async function moveItemsAndDeleteSpace(fromSpaceId: string, toSpaceId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error: moveError } = await supabase
    .from("items")
    .update({ space_id: toSpaceId })
    .eq("space_id", fromSpaceId)
    .eq("owner_id", user.id);

  if (moveError) return fail("Não foi possível mover os itens.");

  const { error: deleteError } = await supabase
    .from("spaces")
    .delete()
    .eq("id", fromSpaceId)
    .eq("owner_id", user.id);

  if (deleteError) return fail("Os itens foram movidos, mas não foi possível excluir o espaço.");

  revalidatePath("/", "layout");
  redirect("/inbox");
}

const newItemSchema = z.object({
  spaceId: z.string().uuid(),
  typeId: z.string().uuid().optional(),
  title: z.string().trim().max(200).optional(),
});

/**
 * Criação mínima de item para o botão "Novo" da página do espaço (tarefa
 * 1.4). A criação/edição completa (editor Tiptap, propriedades, etc.) é a
 * tarefa 1.6/1.7 — isto só garante um item de verdade para abrir.
 */
export async function createItemInSpace(_prevState: Result<null>, formData: FormData): Promise<Result<null>> {
  const parsed = newItemSchema.safeParse({
    spaceId: formData.get("spaceId"),
    typeId: formData.get("typeId") || undefined,
    title: formData.get("title") || undefined,
  });

  if (!parsed.success) return fail("Não foi possível criar o item.");

  const { supabase, user } = await requireOwner();

  const { data, error } = await supabase
    .from("items")
    .insert({
      owner_id: user.id,
      space_id: parsed.data.spaceId,
      type_id: parsed.data.typeId ?? null,
      title: parsed.data.title ?? "",
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) return fail("Não foi possível criar o item.");

  redirect(`/itens/${data.id}`);
}
