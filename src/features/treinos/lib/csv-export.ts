import { addDaysToDateString } from "@/lib/dates";
import { sortSessions, validReps, type ExerciseEntry } from "./rules";

interface SessionRow {
  id: string;
  date: string;
  createdAt?: string;
  week: number;
  workout: string;
  trafficLight: string;
  sleepHours: number | null;
  energy: number;
  kneePainBefore: number;
  backPainBefore: number;
  exercises: Record<string, ExerciseEntry>;
  durationMin: number | null;
  kneePainAfter: number | null;
  backPainAfter: number | null;
  kneePainMorning: number | null;
  backPainMorning: number | null;
  notes: string;
}

interface WeeklyRow {
  weekStart: string;
  weightKg: number | null;
  waistCm: number | null;
  stepsAvg: number | null;
}

const LIGHT_PT: Record<string, string> = { green: "verde", yellow: "amarelo", red: "vermelho" };

/** `;` como separador e vírgula decimal: o Excel em português abre direto. */
function cell(value: unknown): string {
  const s = value === null || value === undefined ? "" : typeof value === "number" ? String(value).replace(".", ",") : String(value);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildSessionsCsv(sessions: SessionRow[]): string {
  const header = [
    "data", "semana", "treino", "semaforo", "sono_h", "energia", "dor_joelho_antes", "dor_lombar_antes",
    "exercicio", "carga_kg", "reps", "rir", "dor_exercicio", "nota",
    "duracao_min", "dor_joelho_depois", "dor_lombar_depois", "dor_joelho_manha", "dor_lombar_manha", "obs",
  ];
  const lines = [header.join(";")];
  for (const s of sortSessions(sessions)) {
    for (const [id, e] of Object.entries(s.exercises)) {
      if (e.skipped || validReps(e.reps).length === 0) continue;
      lines.push(
        [
          s.date, s.week, s.workout, LIGHT_PT[s.trafficLight] ?? s.trafficLight, s.sleepHours, s.energy, s.kneePainBefore, s.backPainBefore,
          e.name ?? id, e.load, validReps(e.reps).join("/"), e.rir, e.pain, e.note,
          s.durationMin, s.kneePainAfter, s.backPainAfter, s.kneePainMorning, s.backPainMorning, s.notes,
        ].map(cell).join(";"),
      );
    }
  }
  return lines.join("\n");
}

export function sessionsInWeek(sessions: { date: string }[], weekStart: string): number {
  const end = addDaysToDateString(weekStart, 7);
  return sessions.filter((s) => s.date >= weekStart && s.date < end).length;
}

export function buildWeeklyCsv(weekly: WeeklyRow[], sessions: { date: string }[]): string {
  const lines = ["inicio_semana;peso_medio_kg;cintura_cm;passos_media;treinos"];
  for (const w of [...weekly].sort((a, b) => a.weekStart.localeCompare(b.weekStart))) {
    lines.push([w.weekStart, w.weightKg, w.waistCm, w.stepsAvg, sessionsInWeek(sessions, w.weekStart)].map(cell).join(";"));
  }
  return lines.join("\n");
}

/** BOM na frente: sem ele o Excel no Windows lê o UTF-8 como Latin-1 e troca os acentos. */
export function downloadCsv(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
