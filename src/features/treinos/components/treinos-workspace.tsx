"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WeeklyMeasure, WorkoutProgram, WorkoutSession } from "../queries";
import { ChartsTab } from "./charts-tab";
import { HistoryTab } from "./history-tab";
import { ProgramTab } from "./program-tab";
import { RegisterTab } from "./register-tab";
import { WeeklyTab } from "./weekly-tab";

type Tab = "registrar" | "historico" | "graficos" | "semanal" | "programa";
const TABS: [Tab, string][] = [
  ["registrar", "Registrar"],
  ["historico", "Histórico"],
  ["graficos", "Gráficos"],
  ["semanal", "Semanal"],
  ["programa", "Programa"],
];

export function TreinosWorkspace({ programs, sessions, weekly }: { programs: WorkoutProgram[]; sessions: WorkoutSession[]; weekly: WeeklyMeasure[] }) {
  const router = useRouter();
  const active = programs.find((p) => p.active) ?? null;
  // Sem programa ainda, a primeira coisa a fazer é montar/importar um.
  const [tab, setTab] = useState<Tab>(active ? "registrar" : "programa");
  const refresh = () => router.refresh();

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Treinos" className="sticky top-0 z-20 grid grid-cols-5 gap-1 rounded-xl border border-black/[.08] bg-[var(--background)] p-1 dark:border-white/[.08]">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-lg py-2 text-xs font-medium sm:text-sm ${
              tab === id ? "bg-black text-white dark:bg-white dark:text-black" : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-300 dark:hover:bg-white/[.06]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "registrar" &&
        (active ? (
          // `key`: trocar o programa em uso recomeça o formulário.
          <RegisterTab key={active.id} program={active} sessions={sessions} onSaved={() => { refresh(); setTab("historico"); }} />
        ) : (
          <p className="rounded-xl border border-black/[.08] p-4 text-sm text-zinc-600 dark:border-white/[.08] dark:text-zinc-300">
            Primeiro monte ou importe o seu programa na aba{" "}
            <button type="button" onClick={() => setTab("programa")} className="font-medium underline">
              Programa
            </button>
            .
          </p>
        ))}
      {tab === "historico" && <HistoryTab programs={programs} sessions={sessions} weekly={weekly} onChanged={refresh} />}
      {tab === "graficos" && <ChartsTab program={active?.definition ?? null} sessions={sessions} weekly={weekly} />}
      {tab === "semanal" && <WeeklyTab weekly={weekly} sessions={sessions} onChanged={refresh} />}
      {tab === "programa" && <ProgramTab programs={programs} onChanged={refresh} />}
    </div>
  );
}
