"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DayChips } from "@/features/habits/components/day-chips";
import { describeFrequency, weekdayOf, WEEKDAY_LONG, WEEKDAY_SHORT, WEEKDAYS, type Weekday } from "@/features/habits/lib/habit-week";
import { deleteRoutineBlock, saveRoutineBlock } from "../actions";
import { blockRunsOn, describeBlockTime, sortBlocks, type RoutineBlock } from "../lib/routine-blocks";

type Draft = { id?: string; title: string; start: string; end: string; days: Weekday[] };

const EMPTY: Draft = { title: "", start: "08:00", end: "", days: [] };

/**
 * Rotina por horário (10.2): a semana em colunas (no celular, um dia embaixo do
 * outro) com os blocos fixos. Tocar num bloco edita; aparece também na Agenda
 * e no Hoje ("Agora: …").
 */
export function RoutineSchedule({ blocks: serverBlocks, today }: { blocks: RoutineBlock[]; today: string }) {
  // Depois de salvar, a ação devolve a lista nova — mostra na hora, sem esperar a página recarregar.
  const [saved, setSaved] = useState<RoutineBlock[] | null>(null);
  const blocks = sortBlocks(saved ?? serverBlocks);
  const [draft, setDraft] = useState<Draft | null>(null);
  const todayWeekday = weekdayOf(today);

  function edit(block: RoutineBlock) {
    setDraft({ id: block.id, title: block.title, start: block.start, end: block.end ?? "", days: block.days });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-black/[.06] bg-surface p-4 shadow-sm sm:p-5 dark:border-white/[.06]">
        <header className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-black dark:text-zinc-50">Horários da semana</h2>
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY })}
            className="bg-brand text-brand-fg flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" aria-hidden /> Bloco
          </button>
        </header>

        {draft && !draft.id && <BlockForm draft={draft} onChange={setDraft} onDone={(next) => { if (next) setSaved(next); setDraft(null); }} />}

        {blocks.length === 0 && !draft ? (
          <p className="rounded-xl bg-surface-muted px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum horário ainda. Monte sua semana com blocos fixos — por exemplo &quot;6h Acordar&quot;, &quot;8h–9h Academia&quot; seg, qua e sex, &quot;13h–14h Almoço&quot; nos dias úteis.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-7">
            {WEEKDAYS.map((day) => {
              const dayBlocks = blocks.filter((b) => blockRunsOn(b, day));
              const isToday = day === todayWeekday;
              return (
                <section key={day} aria-label={WEEKDAY_LONG[day]} className={`flex flex-col gap-1.5 rounded-xl p-2 ${isToday ? "bg-brand-soft" : "bg-surface-muted"}`}>
                  <h3 className={`text-xs font-semibold ${isToday ? "text-brand-text" : "text-zinc-500 dark:text-zinc-400"}`}>
                    <span className="sm:hidden">{WEEKDAY_LONG[day]}</span>
                    <span className="hidden sm:inline">{WEEKDAY_SHORT[day]}</span>
                    {isToday && " · hoje"}
                  </h3>
                  {dayBlocks.length === 0 ? (
                    <p className="text-xs text-zinc-400">—</p>
                  ) : (
                    dayBlocks.map((block) => (
                      <button
                        key={block.id}
                        type="button"
                        onClick={() => edit(block)}
                        aria-label={`${describeBlockTime(block)} ${block.title} (editar)`}
                        className="flex items-baseline gap-2 rounded-lg border-l-4 border-teal-600 bg-surface px-2 py-1.5 text-left sm:flex-col sm:items-stretch sm:gap-0 sm:py-1 shadow-sm hover:bg-black/[.03] dark:hover:bg-white/[.04]"
                      >
                        <span className="w-[5.75rem] shrink-0 whitespace-nowrap text-xs font-medium tabular-nums text-teal-700 sm:w-auto sm:text-[11px] dark:text-teal-300">{describeBlockTime(block)}</span>
                        <span className="text-sm leading-tight text-zinc-800 dark:text-zinc-100">{block.title}</span>
                      </button>
                    ))
                  )}
                </section>
              );
            })}
          </div>
        )}

        {draft?.id && <BlockForm draft={draft} onChange={setDraft} onDone={(next) => { if (next) setSaved(next); setDraft(null); }} />}

        <p className="text-xs text-zinc-500 dark:text-zinc-400">Os blocos aparecem na Agenda (em verde-azulado) e no Hoje, sem virar evento do Google.</p>
      </section>
    </div>
  );
}

function BlockForm({ draft, onChange, onDone }: { draft: Draft; onChange: (d: Draft) => void; onDone: (blocks: RoutineBlock[] | null) => void }) {
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveRoutineBlock({ id: draft.id, title: draft.title, start: draft.start, end: draft.end || null, days: draft.days });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDone(result.data);
    });
  }

  function remove() {
    if (!draft.id) return;
    const id = draft.id;
    startTransition(async () => {
      const result = await deleteRoutineBlock(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDone(result.data);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl bg-surface-muted p-3">
      <p className="text-sm font-medium text-black dark:text-zinc-100">{draft.id ? "Editar bloco" : "Novo bloco"}</p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">Nome</span>
        <input
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          placeholder="Ex.: Academia"
          maxLength={80}
          required
          disabled={pending}
          className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.16]"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Começa</span>
          <input
            type="time"
            value={draft.start}
            onChange={(e) => onChange({ ...draft, start: e.target.value })}
            required
            disabled={pending}
            className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.16]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Termina (opcional)</span>
          <input
            type="time"
            value={draft.end}
            onChange={(e) => onChange({ ...draft, end: e.target.value })}
            disabled={pending}
            className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.16]"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <DayChips value={draft.days} onChange={(days) => onChange({ ...draft, days })} disabled={pending} />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{draft.days.length === 0 ? "Nenhum dia marcado = todo dia." : describeFrequency(`BYDAY=${draft.days.join(",")}`)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending || !draft.title.trim()} className="bg-brand text-brand-fg rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-60">
          Salvar
        </button>
        <button type="button" onClick={() => onDone(null)} disabled={pending} className="rounded-lg border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]">
          Cancelar
        </button>
        {draft.id && (
          <button type="button" onClick={remove} disabled={pending} className="ml-auto text-sm text-red-600 hover:underline dark:text-red-400">
            Apagar bloco
          </button>
        )}
      </div>
    </form>
  );
}
