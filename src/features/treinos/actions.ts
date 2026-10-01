"use server";

import mammoth from "mammoth";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { readFileText } from "@/lib/csv";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { parseProgramText, type ParsedProgram } from "./lib/parse-program";
import { findWorkout, programDefinitionSchema } from "./lib/program";
import { canSaveSession, trafficLight } from "./lib/rules";
import { morningPainSchema, programInputSchema, sessionInputSchema, setHeightSchema, weeklyInputSchema } from "./schemas";

const MAX_PROGRAM_FILE_BYTES = 4 * 1024 * 1024;

const PATH = "/treinos";
const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";

export async function saveWorkoutSession(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = sessionInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const s = parsed.data;

  const { supabase, user } = await requireOwner();

  // O treino e os exercícios válidos vêm do programa salvo, não do que o navegador mandou.
  const { data: programRow } = await supabase.from("workout_programs").select("definition").eq("id", s.programId).eq("owner_id", user.id).maybeSingle();
  const program = programRow ? programDefinitionSchema.safeParse(programRow.definition) : null;
  const workout = program?.success ? findWorkout(program.data, s.workout) : undefined;
  if (!workout) return fail("Treino não encontrado no programa. Recarregue a página.");

  // Só os exercícios do treino escolhido (com o nome da época); pelo menos um com repetições.
  const exercises = Object.fromEntries(
    workout.exercises.filter((ex) => s.exercises[ex.id]).map((ex) => [ex.id, { ...s.exercises[ex.id]!, name: ex.name }]),
  );
  // Dia só de cardio (tudo "Pulei") também é treino: basta ter duração ou observação.
  if (!canSaveSession({ exercises, durationMin: s.durationMin, notes: s.notes })) {
    return fail("Preencha as séries de algum exercício ou, se foi só cardio, a duração ou uma observação em “Fim do treino”.");
  }

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      owner_id: user.id,
      program_id: s.programId,
      session_date: s.date,
      program_week: s.week,
      workout: s.workout,
      sleep_hours: s.sleepHours,
      energy: s.energy,
      knee_pain_before: s.kneePainBefore,
      back_pain_before: s.backPainBefore,
      swelling: s.swelling,
      sick: s.sick,
      traffic_light: trafficLight(s),
      exercises: exercises as unknown as Json,
      duration_min: s.durationMin,
      knee_pain_after: s.kneePainAfter,
      back_pain_after: s.backPainAfter,
      notes: s.notes || null,
    })
    .select("id")
    .single();
  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath(PATH);
  return ok({ id: data.id });
}

/** Dor na manhã seguinte — entra na regra de subir carga dos exercícios sensíveis. */
export async function updateMorningPain(input: unknown): Promise<Result<null>> {
  const parsed = morningPainSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const { supabase, user } = await requireOwner();
  const { error } = await supabase
    .from("workout_sessions")
    .update({ knee_pain_morning: parsed.data.kneePainMorning, back_pain_morning: parsed.data.backPainMorning })
    .eq("id", parsed.data.sessionId)
    .eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  revalidatePath(PATH);
  return ok(null);
}

export async function deleteWorkoutSession(sessionId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("workout_sessions").delete().eq("id", sessionId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível excluir.");
  revalidatePath(PATH);
  return ok(null);
}

/** Uma linha por semana: salvar de novo a mesma semana substitui os valores. */
export async function saveWeeklyMeasure(input: unknown): Promise<Result<null>> {
  const parsed = weeklyInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("workout_weekly").upsert(
    {
      owner_id: user.id,
      week_start: parsed.data.weekStart,
      weight_kg: parsed.data.weightKg,
      waist_cm: parsed.data.waistCm,
      steps_avg: parsed.data.stepsAvg,
    },
    { onConflict: "owner_id,week_start" },
  );
  if (error) return fail(GENERIC_ERROR);
  revalidatePath(PATH);
  return ok(null);
}

export async function deleteWeeklyMeasure(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("workout_weekly").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return fail("Não foi possível excluir.");
  revalidatePath(PATH);
  return ok(null);
}

/** Altura pro IMC (10.6) — guardada em `user_settings.preferences.heightCm`, mesmo lugar de `waterGoalMl`/`ownerWhatsapp`. */
export async function setHeight(input: unknown): Promise<Result<null>> {
  const parsed = setHeightSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Altura inválida.");
  const { supabase, user } = await requireOwner();

  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", user.id).maybeSingle();
  const preferences = (data?.preferences as Record<string, unknown> | null) ?? {};

  const { error } = await supabase
    .from("user_settings")
    .upsert({ owner_id: user.id, preferences: { ...preferences, heightCm: parsed.data.heightCm } as unknown as Json }, { onConflict: "owner_id" });
  if (error) return fail(GENERIC_ERROR);

  revalidatePath(PATH);
  return ok(null);
}

/**
 * Lê um programa de um `.docx` (ou `.txt`) — só a pré-visualização; nada é
 * gravado até o dono conferir e salvar (`saveWorkoutProgram`).
 */
export async function previewProgramImport(formData: FormData): Promise<Result<ParsedProgram & { name: string }>> {
  await requireOwner();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Escolha um arquivo .docx ou .txt.");
  if (file.size > MAX_PROGRAM_FILE_BYTES) return fail("Arquivo grande demais (limite de 4 MB).");

  const lower = file.name.toLowerCase();
  let text: string;
  try {
    if (lower.endsWith(".docx")) {
      text = (await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) })).value;
    } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      text = await readFileText(file);
    } else {
      return fail("Formato não suportado: use .docx (Word) ou .txt.");
    }
  } catch {
    return fail("Não consegui ler esse arquivo.");
  }

  const parsed = parseProgramText(text);
  if (parsed.definition.workouts.length === 0) return fail(parsed.warnings[0] ?? "Nenhum treino encontrado no arquivo.");
  const name = file.name.replace(/\.(docx|txt|md)$/i, "").trim().slice(0, 120) || "Programa importado";
  return ok({ ...parsed, name });
}

/** Cria ou atualiza um programa; `activate` o torna o programa usado no registro. */
export async function saveWorkoutProgram(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = programInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Programa inválido.");
  const { supabase, user } = await requireOwner();
  const p = parsed.data;

  // Um ativo por vez (índice único parcial): desliga os outros antes de ligar este.
  if (p.activate) {
    const { error } = await supabase.from("workout_programs").update({ active: false }).eq("owner_id", user.id).eq("active", true);
    if (error) return fail(GENERIC_ERROR);
  }

  const row = { owner_id: user.id, name: p.name, definition: p.definition as unknown as Json, ...(p.activate ? { active: true } : {}) };
  const { data, error } = p.id
    ? await supabase.from("workout_programs").update(row).eq("id", p.id).eq("owner_id", user.id).select("id").single()
    : await supabase.from("workout_programs").insert(row).select("id").single();
  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath(PATH);
  return ok({ id: data.id });
}

export async function activateWorkoutProgram(programId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error: offError } = await supabase.from("workout_programs").update({ active: false }).eq("owner_id", user.id).eq("active", true);
  if (offError) return fail(GENERIC_ERROR);
  const { error } = await supabase.from("workout_programs").update({ active: true }).eq("id", programId).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  revalidatePath(PATH);
  return ok(null);
}

/** Os treinos já registrados ficam (com o nome dos exercícios guardado em cada um). */
export async function deleteWorkoutProgram(programId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("workout_programs").delete().eq("id", programId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível excluir.");
  revalidatePath(PATH);
  return ok(null);
}
