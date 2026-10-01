import { z } from "zod";

export const saveRecipeSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Dê um nome à receita.").max(120),
  servings: z.number().int().positive().max(100),
  ingredientsText: z.string().trim().max(4000),
});

export const weekStartSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export const generateShoppingListSchema = z.object({ weekStart: weekStartSchema });
