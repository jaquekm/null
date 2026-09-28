import { z } from "zod";

/** Séries × faixa de repetições (ou segundos) + RIR alvo ("—" quando não se aplica). */
export const prescriptionSchema = z.object({
  sets: z.number().int().min(1).max(10),
  min: z.number().int().min(1).max(600),
  max: z.number().int().min(1).max(600),
  rir: z.string().trim().max(10),
});
export type Prescription = z.infer<typeof prescriptionSchema>;

export const programExerciseSchema = z.object({
  /** Estável entre treinos: o mesmo exercício em A e C (ex.: flexora) compartilha histórico. */
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  /** Semanas 1–2 (readaptação). */
  early: prescriptionSchema,
  /** Semana 3 em diante. */
  later: prescriptionSchema,
  unit: z.string().trim().max(20),
  /** Tem carga em kg (sem isso, progride em dificuldade/tempo). */
  load: z.boolean(),
  /** Joelho/lombar sensível: só sobe carga com dor ≤2 durante e na manhã seguinte. */
  sensitive: z.boolean(),
  increment: z.string().trim().max(60),
});
export type ProgramExercise = z.infer<typeof programExerciseSchema>;

export const programWorkoutSchema = z.object({
  id: z.string().regex(/^[A-Z]$/),
  name: z.string().trim().max(120),
  exercises: z.array(programExerciseSchema).max(20),
});
export type ProgramWorkout = z.infer<typeof programWorkoutSchema>;

export const programDefinitionSchema = z.object({
  workouts: z
    .array(programWorkoutSchema)
    .min(1, "O programa precisa de pelo menos um treino.")
    .max(7)
    .refine((ws) => new Set(ws.map((w) => w.id)).size === ws.length, "Letras de treino repetidas."),
});
export type ProgramDefinition = z.infer<typeof programDefinitionSchema>;

export function prescriptionFor(exercise: ProgramExercise, week: number): Prescription {
  return week <= 2 ? exercise.early : exercise.later;
}

export function findWorkout(program: ProgramDefinition, workoutId: string): ProgramWorkout | undefined {
  return program.workouts.find((w) => w.id === workoutId);
}

/** Todos os exercícios do programa, sem repetir (o mesmo id pode estar em mais de um treino). */
export function programExercises(program: ProgramDefinition): ProgramExercise[] {
  const seen = new Map<string, ProgramExercise>();
  for (const workout of program.workouts) for (const ex of workout.exercises) if (!seen.has(ex.id)) seen.set(ex.id, ex);
  return [...seen.values()];
}

export function exerciseIdFromName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "exercicio"
  );
}
