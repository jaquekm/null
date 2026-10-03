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

export function TreinosWorkspace({
  programs,
  sessions,
  weekly,
  heightCm,
}: {
  programs: WorkoutProgram[];
  sessions: WorkoutSession[];
  weekly: WeeklyMeasure[];
  heightCm: number | null;
}) {
  const router = useRouter();
  const active = programs.find((p) => p.active) ?? null;
  // Sem programa ainda, a primeira coisa a fazer é montar/importar um.
  const [tab, setTab] = useState<Tab>(active ? "registrar" : "programa");
  // Treino do histórico sendo corrigido: a aba Registrar abre com ele preenchido.
  const [editing, setEditing] = useState<WorkoutSession | null>(null);
  const editingProgram = editing ? programs.find((p) => p.id === editing.programId) ?? null : null;
  const refresh = () => router.refresh();
  const selectTab = (next: Tab) => {
    if (next !== "registrar") setEditing(null);
    setTab(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Treinos" className="sticky top-0 z-20 grid grid-cols-5 gap-1 rounded-xl border border-black/[.08] bg-[var(--background)] p-1 dark:border-white/[.08]">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => selectTab(id)}
            className={`rounded-lg py-2 text-xs font-medium sm:text-sm ${
              tab === id ? "bg-brand text-brand-fg" : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-300 dark:hover:bg-white/[.06]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "registrar" && editing && editingProgram && (
        <RegisterTab
          key={`editar-${editing.id}`}
          program={editingProgram}
          sessions={sessions}
          editing={editing}
          onCancelEdit={() => selectTab("historico")}
          onSaved={() => {
            refresh();
            selectTab("historico");
          }}
        />
      )}
      {tab === "registrar" &&
        !editing &&
        (active ? (
          // `key`: trocar o programa em uso recomeça o formulário.
          <RegisterTab key={active.id} program={active} sessions={sessions} onSaved={() => { refresh(); selectTab("historico"); }} />
        ) : (
          <p className="rounded-xl border border-black/[.08] p-4 text-sm text-zinc-600 dark:border-white/[.08] dark:text-zinc-300">
            Primeiro monte ou importe o seu programa na aba{" "}
            <button type="button" onClick={() => selectTab("programa")} className="font-medium underline">
              Programa
            </button>
            .
          </p>
        ))}
      {tab === "historico" && (
        <HistoryTab
          programs={programs}
          sessions={sessions}
          weekly={weekly}
          onChanged={refresh}
          onEdit={(session) => {
            setEditing(session);
            setTab("registrar");
          }}
        />
      )}
      {tab === "graficos" && <ChartsTab program={active?.definition ?? null} sessions={sessions} weekly={weekly} heightCm={heightCm} />}
      {tab === "semanal" && <WeeklyTab weekly={weekly} sessions={sessions} heightCm={heightCm} onChanged={refresh} />}
      {tab === "programa" && <ProgramTab programs={programs} onChanged={refresh} />}
    </div>
  );
}
