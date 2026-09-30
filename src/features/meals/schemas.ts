import { z } from "zod";
import { WEEKDAYS } from "@/features/habits/lib/habit-week";
import { MEAL_KEYS } from "./lib/meal-slots";

export const toggleMealSchema = z.object({ mealKey: z.enum(MEAL_KEYS) });

const weekStartSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export const setMealPlanCellSchema = z.object({
  weekStart: weekStartSchema,
  day: z.enum(WEEKDAYS),
  mealKey: z.enum(MEAL_KEYS),
  text: z.string().trim().max(200),
});

export const copyPlanDaySchema = z.object({
  weekStart: weekStartSchema,
  from: z.enum(WEEKDAYS),
  to: z.enum(WEEKDAYS),
});

export const repeatWeekSchema = z.object({
  fromWeekStart: weekStartSchema,
  toWeekStart: weekStartSchema,
});
