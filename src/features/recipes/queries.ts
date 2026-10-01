import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Ingredient } from "./lib/ingredients";

type Client = SupabaseClient<Database>;

export interface RecipeRow {
  id: string;
  title: string;
  servings: number;
  ingredients: Ingredient[];
}

/** Receitas da dona (10.10), pra listar em `/receitas` e pra casar com o cardápio na lista de compras. */
export async function listRecipes(supabase: Client): Promise<RecipeRow[]> {
  const { data: types } = await supabase.from("object_types").select("id").eq("slug", "receita-culinaria").is("archived_at", null);
  const typeIds = (types ?? []).map((t) => t.id);
  if (typeIds.length === 0) return [];

  const { data: items } = await supabase
    .from("items")
    .select("id, title, properties")
    .in("type_id", typeIds)
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("title", { ascending: true });

  return (items ?? []).map((row) => {
    const properties = (row.properties as Record<string, unknown> | null) ?? {};
    const servings = typeof properties.porcoes === "number" && properties.porcoes > 0 ? properties.porcoes : 1;
    const ingredients = Array.isArray(properties.ingredients)
      ? (properties.ingredients.filter(
          (i): i is Ingredient => Boolean(i) && typeof i === "object" && typeof (i as Ingredient).name === "string" && typeof (i as Ingredient).qty === "number",
        ) as Ingredient[])
      : [];
    return { id: row.id, title: row.title || "Sem título", servings, ingredients };
  });
}
