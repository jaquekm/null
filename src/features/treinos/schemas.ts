import { z } from "zod";
import { programDefinitionSchema } from "./lib/program";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const pain = z.number().int().min(0).max(10);

export const exerciseEntrySchema = z.object({
  name: z.string().trim().max(120).optional(),
  load: z.string().trim().max(10).regex(/^$|^\d{1,4}([.,]\d{1,2})?$/, "Carga inválida."),
  reps: z.array(z.string().trim().max(4).regex(/^$|^\d{1,3}$/, "Repetições inválidas.")).max(6),
  rir: z.number().int().min(0).max(5).nullable(),
  pain,
  note: z.string().trim().max(300),
  skipped: z.boolean(),
});

export const sessionInputSchema = z.object({
  programId: z.string().uuid(),
  date: dateSchema,
  week: z.number().int().min(1).max(520),
  workout: z.string().regex(/^[A-Z]$/),
  sleepHours: z.number().min(0).max(24).nullable(),
  energy: z.number().int().min(1).max(5),
  kneePainBefore: pain,
  backPainBefore: pain,
  swelling: z.boolean(),
  sick: z.boolean(),
  exercises: z.record(z.string().max(80), exerciseEntrySchema),
  durationMin: z.number().int().min(0).max(600).nullable(),
  kneePainAfter: pain.nullable(),
  backPainAfter: pain.nullable(),
  notes: z.string().trim().max(2000),
});
export type SessionInput = z.infer<typeof sessionInputSchema>;

export const morningPainSchema = z.object({
  sessionId: z.string().uuid(),
  kneePainMorning: pain.nullable(),
  backPainMorning: pain.nullable(),
});

export const weeklyInputSchema = z
  .object({
    weekStart: dateSchema,
    weightKg: z.number().positive().max(500).nullable(),
    waistCm: z.number().positive().max(300).nullable(),
    stepsAvg: z.number().int().min(0).max(200_000).nullable(),
  })
  .refine((w) => w.weightKg !== null || w.waistCm !== null || w.stepsAvg !== null, "Preencha ao menos um campo.");
export type WeeklyInput = z.infer<typeof weeklyInputSchema>;

export const programInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Dê um nome ao programa.").max(120),
  definition: programDefinitionSchema,
  activate: z.boolean().default(true),
});
export type ProgramInput = z.infer<typeof programInputSchema>;
