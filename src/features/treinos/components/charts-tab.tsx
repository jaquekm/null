"use client";

import { useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { todayInTimezone } from "@/lib/dates";
import { exerciseProgress, formatMinutes, trainingStats, weeklyCounts } from "../lib/chart-data";
import { bmiSeries } from "../lib/bmi";
import { programExercises, type ProgramDefinition } from "../lib/program";
import { exerciseHistory } from "../lib/rules";
import type { WeeklyMeasure, WorkoutSession } from "../queries";
import { cardClassName, formatShortDate } from "./ui";

const SERIES = "var(--chart-series-1)";
const AXIS_TICK = { fill: "var(--chart-muted)", fontSize: 12 };
const TOOLTIP_STYLE = { background: "var(--background)", border: "1px solid var(--chart-grid)", borderRadius: 8, fontSize: 13 };

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-black/[.08] p-3 dark:border-white/[.08]">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="whitespace-nowrap text-xl font-semibold text-black dark:text-zinc-50">{value}</span>
      {hint && <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>}
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-black/[.03] px-3 py-4 text-center text-sm text-zinc-500 dark:bg-white/[.04] dark:text-zinc-400">{children}</p>;
}

/**
 * Linha com área suave (série única, cor validada). Uma medida por gráfico —
 * nunca dois eixos. Com menos de 2 pontos não há tendência pra mostrar, então
 * quem chama mostra uma dica em vez de um ponto solto.
 */
function TrendChart({ data, unit, height = 180, domain }: { data: { label: string; value: number | null }[]; unit: string; height?: number; domain?: [number, number] }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={36}
          // Folga de 1 unidade em volta dos dados: sem isso, peso 63–64 kg virava uma linha achatada no fundo de uma escala 63–67.
          domain={domain ?? [(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: "var(--chart-muted)" }}
          formatter={(value) => [`${Number(value).toLocaleString("pt-BR")}${unit ? ` ${unit}` : ""}`, ""]}
          separator=""
          contentStyle={TOOLTIP_STYLE}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={SERIES}
          strokeWidth={2}
          fill={SERIES}
          fillOpacity={0.1}
          dot={{ r: 3.5, fill: SERIES, stroke: "var(--background)", strokeWidth: 1.5 }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className={`${cardClassName} rounded-2xl`}>
      <div>
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function ChartsTab({
  program,
  sessions,
  weekly,
  heightCm,
}: {
  program: ProgramDefinition | null;
  sessions: WorkoutSession[];
  weekly: WeeklyMeasure[];
  heightCm: number | null;
}) {
  const today = todayInTimezone();
  const stats = trainingStats(sessions, today);
  const weeks = weeklyCounts(sessions, today);
  const plannedPerWeek = program?.workouts.length ?? 0;

  // Exercícios do programa em uso que já têm histórico (os de programas antigos ficam no Histórico e no CSV).
  const withHistory = (program ? programExercises(program) : []).filter((ex) => exerciseHistory(ex.id, sessions).length > 0);
  const [selectedId, setSelectedId] = useState("");
  const selected = withHistory.find((ex) => ex.id === selectedId) ?? withHistory[0];
  const history = selected ? exerciseHistory(selected.id, sessions) : [];
  const progress = selected?.load ? exerciseProgress(history) : null;
  const exerciseData = history.map((h) => ({
    label: formatShortDate(h.date),
    value: selected?.load ? Number(String(h.load).replace(",", ".")) || null : h.reps.reduce((sum, r) => sum + (Number(r) || 0), 0),
  }));

  const energy = sessions.map((s) => ({ label: formatShortDate(s.date), value: s.energy }));
  const sleep = sessions.map((s) => ({ label: formatShortDate(s.date), value: s.sleepHours }));
  const weight = weekly.map((w) => ({ label: formatShortDate(w.weekStart), value: w.weightKg }));
  const waist = weekly.map((w) => ({ label: formatShortDate(w.weekStart), value: w.waistCm }));
  const hasBody = weekly.some((w) => w.weightKg !== null || w.waistCm !== null);
  const bmi = bmiSeries(weekly, heightCm).map((b) => ({ label: formatShortDate(b.weekStart), value: b.bmi }));
  const hasBmi = heightCm != null && bmi.some((b) => b.value !== null);

  if (sessions.length === 0) {
    return <Hint>Registre seu primeiro treino na aba Registrar e a evolução aparece aqui.</Hint>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Esta semana" value={String(stats.thisWeek)} hint={plannedPerWeek ? `de ${plannedPerWeek} planejados` : undefined} />
        <StatTile label="Média/semana" value={stats.weeklyAverage.toLocaleString("pt-BR")} hint="em 4 semanas" />
        <StatTile label="No mês" value={formatMinutes(stats.minutesThisMonth)} hint="de treino" />
      </div>

      <Section title="Frequência" subtitle="Treinos por semana, nas últimas 8 semanas">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weeks} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={1} />
            <YAxis hide allowDecimals={false} domain={[0, (max: number) => Math.max(max, plannedPerWeek || 1)]} />
            <Tooltip
              cursor={{ fill: "var(--chart-grid)" }}
              formatter={(value) => [`${value} ${Number(value) === 1 ? "treino" : "treinos"}`, ""]}
              labelFormatter={(label) => `Semana de ${label}`}
              separator=""
              contentStyle={TOOLTIP_STYLE}
            />
            <Bar dataKey="count" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={28}>
              {/* Rótulo só nas semanas com treino — número em cada zero seria ruído. */}
              <LabelList dataKey="count" position="top" fill="var(--chart-muted)" fontSize={12} formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Evolução por exercício" subtitle={selected?.load ? "Carga usada em cada treino (kg)" : selected ? `Total por treino (${selected.unit})` : undefined}>
        {withHistory.length === 0 ? (
          <Hint>Quando você registrar séries de um exercício, a evolução dele aparece aqui.</Hint>
        ) : (
          <>
            <div role="radiogroup" aria-label="Exercício" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {withHistory.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  role="radio"
                  aria-checked={ex.id === selected?.id}
                  onClick={() => setSelectedId(ex.id)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                    ex.id === selected?.id
                      ? "border-transparent bg-brand text-brand-fg"
                      : "border-black/[.12] text-zinc-600 hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]"
                  }`}
                >
                  {ex.name}
                </button>
              ))}
            </div>

            {progress && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Início</p>
                  <p className="font-semibold">{progress.first.toLocaleString("pt-BR")} kg</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Última</p>
                  <p className="font-semibold">{progress.last.toLocaleString("pt-BR")} kg</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Variação</p>
                  <p className={`font-semibold ${progress.delta > 0 ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
                    {progress.delta > 0 ? "+" : ""}
                    {progress.delta.toLocaleString("pt-BR")} kg
                  </p>
                </div>
              </div>
            )}

            {history.length >= 2 ? (
              <TrendChart data={exerciseData} unit={selected?.load ? "kg" : (selected?.unit ?? "")} />
            ) : (
              <Hint>Faça esse exercício mais uma vez para ver a linha de evolução.</Hint>
            )}
          </>
        )}
      </Section>

      <Section title="Como você chegou nos treinos" subtitle="Energia (1 a 5) e horas de sono antes de cada treino">
        {sessions.length >= 2 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">Energia</p>
              <TrendChart data={energy} unit="" height={140} domain={[1, 5]} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">Sono (h)</p>
              <TrendChart data={sleep} unit="h" height={140} />
            </div>
          </div>
        ) : (
          <Hint>Com 2 treinos registrados já dá para comparar energia e sono.</Hint>
        )}
      </Section>

      <Section title="Corpo" subtitle="Peso médio, cintura e IMC, da aba Semanal">
        {hasBody && weekly.length >= 2 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">Peso (kg)</p>
              <TrendChart data={weight} unit="kg" height={140} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">Cintura (cm)</p>
              <TrendChart data={waist} unit="cm" height={140} />
            </div>
            {hasBmi ? (
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">IMC</p>
                <TrendChart data={bmi} unit="" height={140} />
              </div>
            ) : (
              <Hint>Informe sua altura na aba Semanal pra ver o IMC.</Hint>
            )}
          </div>
        ) : (
          <Hint>Registre peso e cintura na aba Semanal por 2 semanas para ver a tendência.</Hint>
        )}
      </Section>
    </div>
  );
}
