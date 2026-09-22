"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function dayLabel(date: string): string {
  return format(new Date(`${date}T00:00:00`), "dd/MM", { locale: ptBR });
}

/** Estatísticas da revisão (5.7: "revisões por dia, taxa de acerto, previsão dos próximos 30 dias") — heatmap de calendário virou gráfico de barras (ver PROGRESSO.md). */
export function ReviewStats({
  accuracyPercent,
  reviewsPerDay,
  forecast,
}: {
  accuracyPercent: number | null;
  reviewsPerDay: { date: string; count: number }[];
  forecast: { date: string; count: number }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">Taxa de acerto:</span>
        <span className="text-sm font-medium text-black dark:text-zinc-50">{accuracyPercent != null ? `${accuracyPercent}%` : "—"}</span>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Revisões nos últimos 30 dias</h3>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={reviewsPerDay} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fill: "var(--chart-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--chart-grid)" }} tickLine={false} interval={4} />
            <YAxis tick={{ fill: "var(--chart-muted)", fontSize: 10 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
            <Tooltip
              labelFormatter={(date) => dayLabel(String(date))}
              formatter={(value) => [`${value}`, "Revisões"]}
              contentStyle={{ background: "var(--background)", border: "1px solid var(--chart-grid)", borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="count" fill="var(--chart-income)" radius={[3, 3, 0, 0]} maxBarSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Previsão dos próximos 30 dias</h3>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={forecast} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fill: "var(--chart-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--chart-grid)" }} tickLine={false} interval={4} />
            <YAxis tick={{ fill: "var(--chart-muted)", fontSize: 10 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
            <Tooltip
              labelFormatter={(date) => dayLabel(String(date))}
              formatter={(value) => [`${value}`, "Previstas"]}
              contentStyle={{ background: "var(--background)", border: "1px solid var(--chart-grid)", borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="count" fill="var(--chart-muted)" radius={[3, 3, 0, 0]} maxBarSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
