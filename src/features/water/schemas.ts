import { z } from "zod";

export const addWaterSchema = z.object({ amountMl: z.number().int().positive().max(5000) });
export const setWaterGoalSchema = z.object({ goalMl: z.number().int().positive().max(10000) });
