import { exerciseIdFromName, type Prescription, type ProgramDefinition, type ProgramExercise, type ProgramWorkout } from "./program";

const PLATE = "+1 placa, 2,5–5 kg";
const DASH = "[—–-]";

// "Treino A — Inferiores 1 (quadríceps e joelho) · ~50 min"
const WORKOUT_HEADING = new RegExp(`^Treino\\s+([A-Z])\\s*(?:${DASH}\\s*(.+?))?\\s*(?:·.*)?$`, "i");
// "A1. Leg press 45° — quadríceps e glúteos"
const EXERCISE_HEADING = new RegExp(`^([A-Z])(\\d{1,2})[.)]\\s+(.+?)(?:\\s+${DASH}\\s+.+)?$`);
// "2×12 (RIR 3–4)", "3 × 10–12", "2 × 10–15 s por lado"
const CHUNK = /(\d{1,2})\s*[×x]\s*(\d{1,3})(?:\s*[–-]\s*(\d{1,3}))?\s*(s\b|seg\w*)?(?:[^(→·]*?(por lado|\/lado))?(?:[^(→·]*\(RIR\s*([^)]+)\))?/i;
// "Igual ao A3."
const SAME_AS = /^Igual\s+(?:ao|à|a)\s+([A-Z]\d{1,2})\b/i;

function parseChunk(text: string): (Prescription & { seconds: boolean; perSide: boolean }) | null {
  const m = CHUNK.exec(text);
  if (!m) return null;
  const min = Number(m[2]);
  const max = m[3] ? Number(m[3]) : min;
  return {
    sets: Number(m[1]),
    min: Math.min(min, max),
    max: Math.max(min, max),
    rir: m[6]?.trim().replace(/-/g, "–") ?? "—",
    seconds: Boolean(m[4]),
    perSide: Boolean(m[5]) || /por lado/i.test(text),
  };
}

/** "Sem. 1–2: 2×12 (RIR 3–4) → Sem. 3+: 3×10–12 (RIR 2)" ou só "2×15 (RIR 1–2)" (mesma prescrição nas duas fases). */
export function parsePrescriptionLine(line: string): { early: Prescription; later: Prescription; seconds: boolean; perSide: boolean } | null {
  const [firstPart, secondPart] = line.split("→");
  const early = parseChunk(firstPart ?? "");
  if (!early) return null;
  const later = (secondPart && parseChunk(secondPart)) || early;
  const strip = ({ sets, min, max, rir }: Prescription) => ({ sets, min, max, rir });
  return { early: strip(early), later: strip(later), seconds: early.seconds || later.seconds, perSide: early.perSide || later.perSide };
}

const NO_LOAD = /prancha|dead ?bug|bird ?dog|ponte|isometr|alongamento|mobilidade/i;
const SENSITIVE = /leg ?press|agachamento|extensora|hip ?thrust|afundo|passada|stiff|terra|búlgaro|bulgaro|step/i;

function guessIncrement(name: string, seconds: boolean, load: boolean): string {
  if (seconds) return "+5 s";
  if (!load) return "mais amplitude ou controle";
  if (/leg ?press|hip ?thrust|agachamento|terra/i.test(name)) return "+5–10 kg";
  if (/rosca|elevação lateral|elevacao lateral|halter/i.test(name)) return "+1–2 kg";
  return PLATE;
}

export interface ParsedProgram {
  definition: ProgramDefinition;
  warnings: string[];
}

/**
 * Lê um programa de treino em texto (o `.docx` convertido): "Treino A — nome"
 * abre um treino; "A1. Exercício — foco" abre um exercício, e a linha
 * seguinte com "N×M (RIR x)" é a prescrição. "Igual ao A3" reaproveita o
 * mesmo exercício (mesmo histórico). Carga/"sensível"/incremento são
 * palpites pelo nome — dá pra corrigir depois na tela do programa.
 */
export function parseProgramText(text: string): ParsedProgram {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const workouts = new Map<string, ProgramWorkout>();
  const byCode = new Map<string, ProgramExercise>();
  const warnings: string[] = [];

  const workoutFor = (letter: string): ProgramWorkout => {
    const id = letter.toUpperCase();
    let w = workouts.get(id);
    if (!w) {
      w = { id, name: "", exercises: [] };
      workouts.set(id, w);
    }
    return w;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const workoutMatch = WORKOUT_HEADING.exec(line);
    if (workoutMatch && !EXERCISE_HEADING.test(line)) {
      const w = workoutFor(workoutMatch[1]!);
      if (workoutMatch[2] && !w.name) w.name = workoutMatch[2].trim();
      continue;
    }

    const exMatch = EXERCISE_HEADING.exec(line);
    if (!exMatch) continue;
    const [, letter, number, rawName] = exMatch;
    const code = `${letter}${number}`;
    const next = lines[i + 1] ?? "";
    const workout = workoutFor(letter!);

    const same = SAME_AS.exec(next);
    if (same && byCode.has(same[1]!.toUpperCase())) {
      const original = byCode.get(same[1]!.toUpperCase())!;
      byCode.set(code, original);
      if (!workout.exercises.some((e) => e.id === original.id)) workout.exercises.push(original);
      continue;
    }

    const parsed = parsePrescriptionLine(next);
    if (!parsed) {
      warnings.push(`${code}. ${rawName}: não achei séries×repetições na linha seguinte — ficou 3×10, ajuste na tela do programa.`);
    }
    const name = rawName!.trim();
    const load = !parsed?.seconds && !NO_LOAD.test(name);
    const unit = parsed?.seconds ? (parsed.perSide ? "s/lado" : "s") : parsed?.perSide ? "reps/lado" : "reps";
    const baseId = exerciseIdFromName(name);
    // Nomes iguais em treinos diferentes sem "Igual ao" são o mesmo exercício de propósito.
    const existing = [...byCode.values()].find((e) => e.id === baseId);
    const exercise: ProgramExercise = existing ?? {
      id: baseId,
      name,
      early: parsed?.early ?? { sets: 3, min: 10, max: 10, rir: "—" },
      later: parsed?.later ?? { sets: 3, min: 10, max: 10, rir: "—" },
      unit,
      load,
      sensitive: SENSITIVE.test(name),
      increment: guessIncrement(name, Boolean(parsed?.seconds), load),
    };
    byCode.set(code, exercise);
    if (!workout.exercises.some((e) => e.id === exercise.id)) workout.exercises.push(exercise);
  }

  const definition: ProgramDefinition = {
    workouts: [...workouts.values()]
      .filter((w) => w.exercises.length > 0)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((w) => ({ ...w, name: w.name || `Treino ${w.id}` })),
  };
  if (definition.workouts.length === 0) {
    warnings.push('Não encontrei treinos no formato "Treino A — nome" com exercícios "A1. Nome" e a linha "2×12 (RIR 2)" logo abaixo.');
  }
  return { definition, warnings };
}
