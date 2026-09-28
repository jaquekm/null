import { prescriptionFor, type ProgramDefinition, type ProgramExercise, type ProgramWorkout } from "./program";

export type TrafficLight = "green" | "yellow" | "red";

export interface ExerciseEntry {
  /** Nome na época do treino — o histórico continua legível se o programa mudar. */
  name?: string;
  /** kg como texto (aceita vírgula); "" = não informado. */
  load: string;
  reps: string[];
  rir: number | null;
  pain: number;
  note: string;
  skipped: boolean;
}

export interface CheckIn {
  sleepHours: number | null;
  energy: number;
  kneePainBefore: number;
  backPainBefore: number;
  swelling: boolean;
  sick: boolean;
}

export interface SessionForRules {
  id: string;
  date: string;
  createdAt?: string;
  week: number;
  workout: string;
  exercises: Record<string, ExerciseEntry>;
  kneePainMorning: number | null;
  backPainMorning: number | null;
}

/** Repetições válidas digitadas (ignora campos vazios). */
export function validReps(reps: string[] | undefined): number[] {
  return (reps ?? []).filter((r) => r !== "" && r != null && !Number.isNaN(Number(r))).map(Number);
}

export function parseDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Semáforo do check-in: vermelho = treino mínimo ou não treinar; amarelo =
 * reavaliar depois do aquecimento; verde = treino normal. Sono sem valor
 * conta como 7 h.
 */
export function trafficLight(c: CheckIn): TrafficLight {
  const sleep = c.sleepHours ?? 7;
  const pain = Math.max(c.kneePainBefore || 0, c.backPainBefore || 0);
  if (c.sick || c.swelling || sleep < 5 || c.energy <= 1 || pain >= 4) return "red";
  if (sleep >= 6 && c.energy >= 3 && pain <= 2) return "green";
  return "yellow";
}

export const TRAFFIC_LIGHT_TEXT: Record<TrafficLight, { title: string; text: string }> = {
  green: { title: "Verde", text: "Treino normal." },
  yellow: {
    title: "Amarelo",
    text: "Aquecimento + 1º exercício normais e reavalie. Se não melhorar: 1 série a menos por exercício, RIR +1, sem subir carga e sem cardio.",
  },
  red: {
    title: "Vermelho",
    text: "Treino mínimo: 10 min de bike leve + 3 exercícios sem dor, 2 séries, RIR 3–4. Doente ou com inchaço: não treine.",
  },
};

/** Por data; no mesmo dia, pela ordem em que foram registrados. */
export function sortSessions<T extends { date: string; id: string; createdAt?: string }>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const byCreation = (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
    return byCreation !== 0 ? byCreation : a.id.localeCompare(b.id);
  });
}

/** Semana do programa pela distância até o primeiro treino registrado (semana 1 = primeiros 7 dias). */
export function programWeek(sessions: { date: string; id: string }[], date: string): number {
  if (sessions.length === 0) return 1;
  const first = sortSessions(sessions)[0]!.date;
  const days = (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86_400_000;
  return Math.max(1, Math.floor(days / 7) + 1);
}

/** Próximo treino na sequência do programa (A → B → C → D → A), a partir do último registrado. */
export function nextWorkout(program: ProgramDefinition, sessions: SessionForRules[]): string {
  const order = program.workouts.map((w) => w.id);
  const last = sortSessions(sessions).at(-1);
  const index = last ? order.indexOf(last.workout) : -1;
  return order[(index + 1) % order.length] ?? order[0] ?? "A";
}

/** Última carga usada no exercício (pré-preenche o formulário). */
export function lastLoad(exerciseId: string, sessions: SessionForRules[]): string {
  const found = sortSessions(sessions)
    .reverse()
    .find((s) => {
      const e = s.exercises[exerciseId];
      return e && !e.skipped && e.load !== "" && e.load != null;
    });
  return found ? found.exercises[exerciseId]!.load : "";
}

export function emptyEntries(workout: ProgramWorkout, sessions: SessionForRules[]): Record<string, ExerciseEntry> {
  return Object.fromEntries(
    workout.exercises.map((ex) => [ex.id, { name: ex.name, load: lastLoad(ex.id, sessions), reps: [], rir: null, pain: 0, note: "", skipped: false }]),
  );
}

export interface HistoryPoint extends ExerciseEntry {
  date: string;
  week: number;
  kneePainMorning: number | null;
  backPainMorning: number | null;
}

/** Histórico de um exercício: só sessões em que ele foi feito (com repetições). */
export function exerciseHistory(exerciseId: string, sessions: SessionForRules[]): HistoryPoint[] {
  return sortSessions(sessions)
    .filter((s) => {
      const e = s.exercises[exerciseId];
      return e && !e.skipped && validReps(e.reps).length > 0;
    })
    .map((s) => ({ ...s.exercises[exerciseId]!, date: s.date, week: s.week, kneePainMorning: s.kneePainMorning, backPainMorning: s.backPainMorning }));
}

export type SuggestionTone = "green" | "red" | "amber" | "blue" | "gray";

/**
 * Sugestão de progressão pro próximo treino, pela última vez que o
 * exercício foi feito: dor manda primeiro; na readaptação (semanas 1–2)
 * guia pelo RIR; depois, topo da faixa com RIR e dor ok = subir carga;
 * abaixo da faixa duas vezes seguidas = reduzir ~10%.
 */
export function suggestion(def: ProgramExercise, sessions: SessionForRules[]): { tone: SuggestionTone; text: string } {
  const history = exerciseHistory(def.id, sessions);
  if (history.length === 0) {
    return { tone: "gray", text: def.load ? "Primeira vez: comece leve (RIR 3–4) e anote a carga." : "Primeira vez: foque no controle." };
  }
  const last = history.at(-1)!;
  const { sets, max, rir: rirTarget } = prescriptionFor(def, last.week);
  const reps = validReps(last.reps);
  const pain = last.pain || 0;
  const rir = last.rir;

  if (pain >= 3) return { tone: "red", text: "Dor ≥3 na última vez: reduza amplitude ou carga, ou use a alternativa. Se repetir, troque o exercício." };

  if (last.week <= 2 && def.load) {
    if (rir !== null && rir >= 5) return { tone: "green", text: "Sobrou muito na última: suba um pouco a carga." };
    if (rir !== null && rir <= 1) return { tone: "amber", text: "Ficou pesado para a readaptação: reduza um pouco." };
    return { tone: "gray", text: "Readaptação: mantenha a carga e foque na técnica." };
  }

  const belowRange = (p: HistoryPoint) => validReps(p.reps).some((r) => r < prescriptionFor(def, p.week).min);
  if (history.length >= 2 && belowRange(last) && belowRange(history.at(-2)!)) {
    return { tone: "red", text: "Abaixo da faixa 2 vezes seguidas: reduza ~10% da carga." };
  }

  const atTop = reps.length >= sets && reps.every((r) => r >= max);
  const rirMin = Number.parseInt(rirTarget, 10);
  const rirOk = Number.isNaN(rirMin) || rir === null || rir >= rirMin;
  const morning = Math.max(last.kneePainMorning ?? 0, last.backPainMorning ?? 0);
  const painOk = !def.sensitive || (pain <= 2 && morning <= 2);

  if (atTop && rirOk && painOk) {
    return { tone: "green", text: def.load ? `Topo da faixa: suba a carga (${def.increment}).` : `Topo da faixa: aumente a dificuldade (${def.increment}).` };
  }
  if (atTop && !painOk) return { tone: "amber", text: "Topo da faixa, mas só suba com dor ≤2 durante e na manhã seguinte." };
  return { tone: "blue", text: "Mantenha a carga e busque +1 repetição." };
}

/** Volume do dia no exercício: carga × soma das reps (ou só a soma, sem carga). */
export function exerciseVolume(def: Pick<ProgramExercise, "load">, entry: ExerciseEntry): number {
  const total = validReps(entry.reps).reduce((a, b) => a + b, 0);
  if (!def.load) return total;
  return Math.round((parseDecimal(entry.load) ?? 0) * total);
}
