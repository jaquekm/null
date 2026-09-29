import { describe, expect, it } from "vitest";
import type { ProgramDefinition, ProgramExercise } from "./program";
import {
  canSaveSession,
  emptyEntries,
  exerciseVolume,
  nextWorkout,
  programWeek,
  suggestion,
  trafficLight,
  validReps,
  type ExerciseEntry,
  type SessionForRules,
} from "./rules";

function ex(id: string, overrides: Partial<ProgramExercise> = {}): ProgramExercise {
  return {
    id,
    name: id,
    early: { sets: 2, min: 12, max: 12, rir: "3" },
    later: { sets: 3, min: 10, max: 12, rir: "1–2" },
    unit: "reps",
    load: true,
    sensitive: false,
    increment: "+1 placa, 2,5–5 kg",
    ...overrides,
  };
}

const legpress = ex("legpress", { later: { sets: 3, min: 10, max: 12, rir: "2" }, sensitive: true, increment: "+5–10 kg" });
const flexora = ex("flexora");
const prancha = ex("prancha", { load: false, unit: "s/lado" });

const program: ProgramDefinition = {
  workouts: [
    { id: "A", name: "Inferiores 1", exercises: [legpress, ex("extensora"), flexora, ex("abdutora"), ex("panturrilha"), ex("deadbug", { load: false })] },
    { id: "B", name: "Superiores 1", exercises: [ex("puxada")] },
    { id: "C", name: "Inferiores 2", exercises: [flexora, prancha] },
    { id: "D", name: "Superiores 2", exercises: [ex("desenvolvimento")] },
  ],
};

const checkIn = { sleepHours: 7, energy: 3, kneePainBefore: 0, backPainBefore: 0, swelling: false, sick: false };

function entry(overrides: Partial<ExerciseEntry> = {}): ExerciseEntry {
  return { load: "40", reps: ["12", "12", "12"], rir: 2, pain: 0, note: "", skipped: false, ...overrides };
}

function session(date: string, week: number, workout: SessionForRules["workout"], exercises: Record<string, ExerciseEntry>, extra: Partial<SessionForRules> = {}): SessionForRules {
  return { id: `s-${date}-${workout}`, date, week, workout, exercises, kneePainMorning: null, backPainMorning: null, ...extra };
}

describe("trafficLight", () => {
  it("verde com sono ≥6, energia ≥3 e dor ≤2", () => {
    expect(trafficLight(checkIn)).toBe("green");
    expect(trafficLight({ ...checkIn, sleepHours: null })).toBe("green"); // sem sono informado conta 7 h
  });

  it("vermelho com doença, inchaço, sono <5, energia 1 ou dor ≥4", () => {
    expect(trafficLight({ ...checkIn, sick: true })).toBe("red");
    expect(trafficLight({ ...checkIn, swelling: true })).toBe("red");
    expect(trafficLight({ ...checkIn, sleepHours: 4.5 })).toBe("red");
    expect(trafficLight({ ...checkIn, energy: 1 })).toBe("red");
    expect(trafficLight({ ...checkIn, backPainBefore: 4 })).toBe("red");
  });

  it("amarelo no meio do caminho", () => {
    expect(trafficLight({ ...checkIn, sleepHours: 5.5 })).toBe("yellow");
    expect(trafficLight({ ...checkIn, energy: 2 })).toBe("yellow");
    expect(trafficLight({ ...checkIn, kneePainBefore: 3 })).toBe("yellow");
  });
});

describe("sequência e semana", () => {
  it("próximo treino segue A→B→C→D→A pelo último registrado", () => {
    expect(nextWorkout(program, [])).toBe("A");
    const done = { legpress: entry() };
    expect(nextWorkout(program, [session("2026-09-01", 1, "A", done), session("2026-09-03", 1, "B", done)])).toBe("C");
    expect(nextWorkout(program, [session("2026-09-10", 2, "D", done)])).toBe("A");
    // dia só de cardio (tudo pulado) depois do A: continua sendo a vez do B
    const doneA = session("2026-09-28", 1, "A", { legpress: entry() });
    const cardioOnly = session("2026-09-29", 1, "B", { puxada: entry({ skipped: true, reps: [] }) });
    expect(nextWorkout(program, [doneA, cardioOnly])).toBe("B");
    // treino de um programa antigo que não existe mais: recomeça do primeiro
    expect(nextWorkout(program, [session("2026-09-10", 2, "F", done)])).toBe("A");
  });

  it("semana do programa conta a partir do primeiro treino", () => {
    const sessions = [session("2026-09-01", 1, "A", {})];
    expect(programWeek([], "2026-09-01")).toBe(1);
    expect(programWeek(sessions, "2026-09-07")).toBe(1);
    expect(programWeek(sessions, "2026-09-08")).toBe(2);
    expect(programWeek(sessions, "2026-09-15")).toBe(3);
  });

  it("formulário novo já vem com a última carga de cada exercício", () => {
    const sessions = [session("2026-09-01", 1, "A", { legpress: entry({ load: "80" }) }), session("2026-09-08", 2, "A", { legpress: entry({ load: "", skipped: true }) })];
    const entries = emptyEntries(program.workouts[0]!, sessions);
    expect(entries.legpress!.load).toBe("80");
    expect(entries.extensora!.load).toBe("");
    expect(Object.keys(entries)).toHaveLength(6);
    expect(entries.legpress!.name).toBe("legpress");
  });
});

describe("suggestion", () => {
  it("primeira vez", () => {
    expect(suggestion(legpress, []).tone).toBe("gray");
  });

  it("dor ≥3 na última vez manda reduzir, antes de qualquer outra regra", () => {
    const s = [session("2026-09-20", 3, "A", { legpress: entry({ reps: ["12", "12", "12"], pain: 3 }) })];
    expect(suggestion(legpress, s)).toMatchObject({ tone: "red" });
  });

  it("readaptação (semanas 1–2): guia pelo RIR", () => {
    expect(suggestion(flexora, [session("2026-09-01", 1, "A", { flexora: entry({ rir: 5 }) })]).tone).toBe("green");
    expect(suggestion(flexora, [session("2026-09-01", 1, "A", { flexora: entry({ rir: 1 }) })]).tone).toBe("amber");
    expect(suggestion(flexora, [session("2026-09-01", 1, "A", { flexora: entry({ rir: 3 }) })]).tone).toBe("gray");
  });

  it("topo da faixa com RIR e dor ok: sobe a carga com o incremento do exercício", () => {
    const s = [session("2026-09-20", 3, "A", { flexora: entry({ reps: ["12", "12", "12"], rir: 2 }) })];
    expect(suggestion(flexora, s)).toEqual({ tone: "green", text: "Topo da faixa: suba a carga (+1 placa, 2,5–5 kg)." });
  });

  it("exercício sensível no topo, mas com dor na manhã seguinte >2: segura a carga", () => {
    const s = [session("2026-09-20", 3, "A", { legpress: entry({ reps: ["12", "12", "12"], rir: 2 }) }, { kneePainMorning: 3 })];
    expect(suggestion(legpress, s).tone).toBe("amber");
  });

  it("abaixo da faixa duas vezes seguidas: reduzir ~10%", () => {
    const s = [
      session("2026-09-20", 3, "A", { legpress: entry({ reps: ["9", "10", "10"] }) }),
      session("2026-09-24", 3, "A", { legpress: entry({ reps: ["10", "9", "8"] }) }),
    ];
    expect(suggestion(legpress, s).text).toContain("reduza ~10%");
  });

  it("no meio da faixa: mantém e busca +1 repetição", () => {
    const s = [session("2026-09-20", 3, "A", { legpress: entry({ reps: ["11", "10", "10"] }) })];
    expect(suggestion(legpress, s).tone).toBe("blue");
  });
});

describe("volume e reps", () => {
  it("ignora campos vazios e aceita carga com vírgula", () => {
    expect(validReps(["12", "", "10"])).toEqual([12, 10]);
    expect(exerciseVolume(legpress, entry({ load: "42,5", reps: ["10", "10"] }))).toBe(850);
    expect(exerciseVolume(prancha, entry({ load: "", reps: ["20", "20"] }))).toBe(40);
  });
});

describe("canSaveSession", () => {
  const skipped = { legpress: entry({ skipped: true, reps: [] }), puxada: entry({ skipped: true, reps: [] }) };

  it("dia só de cardio (tudo pulado) salva com duração ou observação", () => {
    expect(canSaveSession({ exercises: skipped, durationMin: 30, notes: "" })).toBe(true);
    expect(canSaveSession({ exercises: skipped, durationMin: null, notes: "bicicleta e esteira 30 min cada" })).toBe(true);
  });

  it("sem exercício feito, sem duração e sem observação: não há o que salvar", () => {
    expect(canSaveSession({ exercises: skipped, durationMin: null, notes: "  " })).toBe(false);
    expect(canSaveSession({ exercises: skipped, durationMin: 0, notes: "" })).toBe(false);
  });

  it("com um exercício feito salva mesmo sem duração", () => {
    expect(canSaveSession({ exercises: { legpress: entry() }, durationMin: null, notes: "" })).toBe(true);
  });
});
