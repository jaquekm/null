"use server";

import type { JSONContent } from "@tiptap/core";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { WEEKDAYS } from "@/features/habits/lib/habit-week";
import { extractText } from "@/features/items/lib/extract-text";
import { addItemToSection } from "@/features/items/lib/list-styles";
import { getWeekPlan } from "@/features/meals/queries";
import { installPack } from "@/features/packs/lib/install";
import { listLocalPacks } from "@/features/packs/queries";
import { findTemplate, templateProperties } from "@/features/templates/lib/templates";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Database, Json } from "@/lib/supabase/database.types";
import { formatIngredientsText, parseIngredientsText, sumIngredients, type Ingredient } from "./lib/ingredients";
import { listRecipes } from "./queries";
import { generateShoppingListSchema, saveRecipeSchema } from "./schemas";

type Client = SupabaseClient<Database>;

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";
const PATH = "/receitas";

async function findRecipeTypeId(supabase: Client): Promise<string | null> {
  const { data } = await supabase.from("object_types").select("id").eq("slug", "receita-culinaria").is("archived_at", null).order("created_at", { ascending: true }).limit(1);
  return data?.[0]?.id ?? null;
}

/** Cria ou atualiza uma receita (10.10) — sem o tipo ainda, instala o pacote "Receitas" na hora. */
export async function saveRecipe(input: z.input<typeof saveRecipeSchema>): Promise<Result<{ id: string }>> {
  const parsed = saveRecipeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { supabase, user } = await requireOwner();

  const properties = { porcoes: parsed.data.servings, ingredients: parseIngredientsText(parsed.data.ingredientsText) } as unknown as Json;

  if (parsed.data.id) {
    const { error } = await supabase.from("items").update({ title: parsed.data.title, properties }).eq("id", parsed.data.id).eq("owner_id", user.id);
    if (error) return fail(GENERIC_ERROR);
    revalidatePath(PATH);
    return ok({ id: parsed.data.id });
  }

  let typeId = await findRecipeTypeId(supabase);
  if (!typeId) {
    const pack = (await listLocalPacks()).find((entry) => entry.pack?.key === "receitas")?.pack;
    if (!pack) return fail("Não achei o pacote de receitas.");
    const installed = await installPack(supabase, user.id, pack, { spaceId: null });
    if (!installed.ok) return fail("Não foi possível preparar as receitas. Tente de novo.");
    typeId = await findRecipeTypeId(supabase);
    if (!typeId) return fail("Não foi possível preparar as receitas. Tente de novo.");
  }

  const { data, error } = await supabase
    .from("items")
    .insert({ owner_id: user.id, title: parsed.data.title, type_id: typeId, status: "active", properties })
    .select("id")
    .single();
  if (error || !data) return fail("Não foi possível criar a receita.");

  revalidatePath(PATH);
  return ok({ id: data.id });
}

/** "Excluir receita" — exclusão lógica, igual a qualquer item (vai pra lixeira). */
export async function deleteRecipe(itemId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("items").update({ deleted_at: new Date().toISOString() }).eq("id", itemId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível excluir.");
  revalidatePath(PATH);
  return ok(null);
}

async function readPreferences(supabase: Client, ownerId: string): Promise<Record<string, unknown>> {
  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle();
  return (data?.preferences as Record<string, unknown> | null) ?? {};
}

/**
 * Soma várias linhas na lista de compras (10.5/10.10) — mesma lista lembrada
 * em `preferences.shoppingListItemId`, cria uma nova a partir do modelo
 * "Lista de compras" (9.2) se a dona ainda não tiver nenhuma. Sem o pacote
 * Listas instalado, só não soma (devolve `false`).
 */
async function appendToShoppingList(supabase: Client, ownerId: string, lines: string[]): Promise<boolean> {
  if (lines.length === 0) return true;
  const preferences = await readPreferences(supabase, ownerId);
  const savedId = typeof preferences.shoppingListItemId === "string" ? preferences.shoppingListItemId : null;

  let listItem: { id: string; content: unknown } | null = null;
  if (savedId) {
    const { data } = await supabase.from("items").select("id, content").eq("id", savedId).eq("owner_id", ownerId).is("deleted_at", null).maybeSingle();
    listItem = data ?? null;
  }

  if (!listItem) {
    const template = findTemplate("lista-compras");
    if (!template) return false;
    const { data: types } = await supabase.from("object_types").select("id").eq("slug", template.typeSlug).is("archived_at", null).is("space_id", null).limit(1);
    const typeId = types?.[0]?.id;
    if (!typeId) return false;

    const { data: created, error } = await supabase
      .from("items")
      .insert({ owner_id: ownerId, type_id: typeId, title: template.defaultTitle, status: "active", properties: templateProperties(template) as Json })
      .select("id, content")
      .single();
    if (error || !created) return false;
    listItem = created;

    await supabase
      .from("user_settings")
      .upsert({ owner_id: ownerId, preferences: { ...preferences, shoppingListItemId: created.id } as unknown as Json }, { onConflict: "owner_id" });
  }

  let content = listItem.content as JSONContent | null;
  for (const line of lines) content = addItemToSection(content, 0, line);
  const { error } = await supabase
    .from("items")
    .update({ content: content as unknown as Json, content_text: extractText(content) })
    .eq("id", listItem.id)
    .eq("owner_id", ownerId);
  return !error;
}

export interface ShoppingListResult {
  matchedRecipes: string[];
  ingredientsAdded: number;
  addedToShoppingList: boolean;
}

/**
 * "Soma os ingredientes do cardápio numa lista" (10.10): cada célula do
 * cardápio cujo texto bate (sem diferenciar maiúsculas) com o nome de uma
 * receita entra na soma; células que não casam nenhuma receita são
 * ignoradas (continuam só texto livre, a dona adiciona à mão se quiser).
 */
export async function generateShoppingListFromWeek(input: z.input<typeof generateShoppingListSchema>): Promise<Result<ShoppingListResult>> {
  const parsed = generateShoppingListSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { supabase, user } = await requireOwner();

  const [plan, recipes] = await Promise.all([getWeekPlan(supabase, user.id, parsed.data.weekStart), listRecipes(supabase)]);
  const recipeByName = new Map(recipes.map((r) => [r.title.trim().toLowerCase(), r]));

  const matched = new Set<string>();
  const lists: Ingredient[][] = [];
  for (const day of WEEKDAYS) {
    const dayPlan = plan[day] ?? {};
    for (const text of Object.values(dayPlan)) {
      if (!text) continue;
      const recipe = recipeByName.get(text.trim().toLowerCase());
      if (!recipe || recipe.ingredients.length === 0) continue;
      matched.add(recipe.title);
      lists.push(recipe.ingredients);
    }
  }

  if (matched.size === 0) return ok({ matchedRecipes: [], ingredientsAdded: 0, addedToShoppingList: false });

  const summed = sumIngredients(lists);
  const lines = formatIngredientsText(summed).split("\n");
  const addedToShoppingList = await appendToShoppingList(supabase, user.id, lines);

  revalidatePath("/cardapio");
  return ok({ matchedRecipes: [...matched], ingredientsAdded: summed.length, addedToShoppingList });
}
