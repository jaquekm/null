import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { programDefinitionSchema, type ProgramDefinition } from "./lib/program";
import type { ExerciseEntry, SessionForRules, TrafficLight } from "./lib/rules";

type Client = SupabaseClient<Database>;

export interface WorkoutSession extends SessionForRules {
  createdAt: string;
  programId: string | null;
  sleepHours: number | null;
  energy: number;
  kneePainBefore: number;
  backPainBefore: number;
  swelling: boolean;
  sick: boolean;
  trafficLight: TrafficLight;
  durationMin: number | null;
  kneePainAfter: number | null;
  backPainAfter: number | null;
  notes: string;
}

export interface WeeklyMeasure {
  id: string;
  weekStart: string;
  weightKg: number | null;
  waistCm: number | null;
  stepsAvg: number | null;
}

export async function listWorkoutSessions(supabase: Client, ownerId: string): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("owner_id", ownerId)
    .order("session_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    programId: row.program_id,
    date: row.session_date,
    week: row.program_week,
    workout: row.workout,
    exercises: (row.exercises ?? {}) as unknown as Record<string, ExerciseEntry>,
    sleepHours: row.sleep_hours === null ? null : Number(row.sleep_hours),
    energy: row.energy,
    kneePainBefore: row.knee_pain_before,
    backPainBefore: row.back_pain_before,
    swelling: row.swelling,
    sick: row.sick,
    trafficLight: row.traffic_light as TrafficLight,
    durationMin: row.duration_min,
    kneePainAfter: row.knee_pain_after,
    backPainAfter: row.back_pain_after,
    kneePainMorning: row.knee_pain_morning,
    backPainMorning: row.back_pain_morning,
    notes: row.notes ?? "",
  }));
}

export async function listWeeklyMeasures(supabase: Client, ownerId: string): Promise<WeeklyMeasure[]> {
  const { data, error } = await supabase
    .from("workout_weekly")
    .select("id, week_start, weight_kg, waist_cm, steps_avg")
    .eq("owner_id", ownerId)
    .order("week_start", { ascending: true });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    weekStart: row.week_start,
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    waistCm: row.waist_cm === null ? null : Number(row.waist_cm),
    stepsAvg: row.steps_avg,
  }));
}

export interface WorkoutProgram {
  id: string;
  name: string;
  definition: ProgramDefinition;
  active: boolean;
  updatedAt: string;
}

export async function listWorkoutPrograms(supabase: Client, ownerId: string): Promise<WorkoutProgram[]> {
  const { data, error } = await supabase
    .from("workout_programs")
    .select("id, name, definition, active, updated_at")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data.flatMap((row) => {
    // Definição inválida (editada à mão no banco) some da lista em vez de derrubar a página.
    const parsed = programDefinitionSchema.safeParse(row.definition);
    return parsed.success ? [{ id: row.id, name: row.name, definition: parsed.data, active: row.active, updatedAt: row.updated_at }] : [];
  });
}
