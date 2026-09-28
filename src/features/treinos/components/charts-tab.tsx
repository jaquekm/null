"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { programExercises, type ProgramDefinition } from "../lib/program";
import { exerciseHistory, exerciseVolume, parseDecimal } from "../lib/rules";
import type { WeeklyMeasure, WorkoutSession } from "../queries";
import { cardClassName, formatShortDate, inputClassName } from "./ui";

interface Point {
  label: string;
  value: number | null;
}

/**
 * Um gráfico = uma medida (sem eixo duplo: energia 1–5 e sono em horas não
 * dividem escala). Série única na cor validada `--chart-series-1`; o título
 * nomeia a série, então não há legenda.
 */
function SeriesChart({ title, unit, data, padding = 0 }: { title: string; unit: string; data: Point[]; padding?: number }) {
  const hasData = data.some((d) => d.value !== null);
  return (
    <section className={cardClassName}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {!hasData ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Sem dados ainda.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "var(--chart-muted)", fontSize: 12 }} axisLine={{ stroke: "var(--chart-grid)" }} tickLine={false} />
            <YAxis
              tick={{ fill: "var(--chart-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={padding ? [`dataMin - ${padding}`, `dataMax + ${padding}`] : ["auto", "auto"]}
              allowDecimals
            />
            <Tooltip
              cursor={{ stroke: "var(--chart-muted)", strokeDasharray: "3 3" }}
              formatter={(value) => [`${Number(value).toLocaleString("pt-BR")} ${unit}`, title]}
              contentStyle={{ background: "var(--background)", border: "1px solid var(--chart-grid)", borderRadius: 8, fontSize: 13 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={title}
              stroke="var(--chart-series-1)"
              strokeWidth={2}
              dot={{ r: 4, fill: "var(--chart-series-1)", stroke: "var(--background)", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

export function ChartsTab({ program, sessions, weekly }: { program: ProgramDefinition | null; sessions: WorkoutSession[]; weekly: WeeklyMeasure[] }) {
  // Exercícios do programa em uso que já têm histórico (exercícios só de programas antigos ficam no Histórico e no CSV).
  const known = program ? programExercises(program) : [];
  const withHistory = known.filter((ex) => exerciseHistory(ex.id, sessions).length > 0);
  const [selectedId, setSelectedId] = useState<string>("");
  const selected = withHistory.find((ex) => ex.id === selectedId) ?? withHistory[0];

  const history = selected ? exerciseHistory(selected.id, sessions) : [];
  const loadData: Point[] = history.map((h) => ({ label: formatShortDate(h.date), value: parseDecimal(h.load) }));
  const volumeData: Point[] = selected ? history.map((h) => ({ label: formatShortDate(h.date), value: exerciseVolume(selected, h) })) : [];

  const energy: Point[] = sessions.map((s) => ({ label: formatShortDate(s.date), value: s.energy }));
  const sleep: Point[] = sessions.map((s) => ({ label: formatShortDate(s.date), value: s.sleepHours }));
  const weight: Point[] = weekly.map((w) => ({ label: formatShortDate(w.weekStart), value: w.weightKg }));
  const waist: Point[] = weekly.map((w) => ({ label: formatShortDate(w.weekStart), value: w.waistCm }));

  return (
    <div className="flex flex-col gap-3">
      <section className={cardClassName}>
        <h2 className="font-semibold">Evolução por exercício</h2>
        {withHistory.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Registre treinos para ver a evolução.</p>
        ) : (
          <select aria-label="Exercício" className={`${inputClassName} w-full`} value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
            {withHistory.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        )}
      </section>

      {selected?.load && <SeriesChart title={`Carga — ${selected.name}`} unit="kg" data={loadData} />}
      {selected && (
        <SeriesChart
          title={selected.load ? `Volume (kg × reps) — ${selected.name}` : `Total (${selected.unit}) — ${selected.name}`}
          unit={selected.load ? "kg" : selected.unit}
          data={volumeData}
        />
      )}
      <SeriesChart title="Energia por treino (1–5)" unit="" data={energy} />
      <SeriesChart title="Sono antes do treino (h)" unit="h" data={sleep} />
      <SeriesChart title="Peso médio da semana (kg)" unit="kg" data={weight} padding={1} />
      <SeriesChart title="Cintura (cm)" unit="cm" data={waist} padding={2} />
    </div>
  );
}
