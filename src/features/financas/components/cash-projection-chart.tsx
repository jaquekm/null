"use client";

import { format } from "date-fns";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/money";
import type { ProjectedDay } from "../lib/cash-projection";

function dayLabel(date: string): string {
  return format(new Date(`${date}T12:00:00`), "dd/MM");
}

function axisTick(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** "Saldo projetado por dia" nos próximos 30 dias (4.12) — série única, sem legenda (o título já diz o que é). */
export function CashProjectionChart({ data }: { data: ProjectedDay[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fill: "var(--chart-muted)", fontSize: 12 }} axisLine={{ stroke: "var(--chart-grid)" }} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={axisTick} tick={{ fill: "var(--chart-muted)", fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
        <ReferenceLine y={0} stroke="var(--chart-expense)" strokeDasharray="4 4" />
        <Tooltip
          labelFormatter={(date) => dayLabel(String(date))}
          formatter={(value) => [formatBRL(Number(value ?? 0)), "Saldo projetado"]}
          contentStyle={{ background: "var(--background)", border: "1px solid var(--chart-grid)", borderRadius: 8, fontSize: 13 }}
        />
        <Line dataKey="balanceCents" stroke="var(--foreground)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
