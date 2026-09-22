"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/money";
import type { MonthCashflow } from "../lib/cashflow-series";

function monthLabel(month: string): string {
  const label = format(new Date(`${month}-01T00:00:00`), "MMM/yy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function axisTick(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** Fluxo de caixa dos últimos 12 meses (4.12): entradas × saídas × resultado, um eixo só (todos em R$). */
export function CashflowChart({ data }: { data: MonthCashflow[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: "var(--chart-muted)", fontSize: 12 }} axisLine={{ stroke: "var(--chart-grid)" }} tickLine={false} />
        <YAxis tickFormatter={axisTick} tick={{ fill: "var(--chart-muted)", fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
        <ReferenceLine y={0} stroke="var(--chart-grid)" />
        <Tooltip
          labelFormatter={(month) => monthLabel(String(month))}
          formatter={(value, name) => [formatBRL(Number(value ?? 0)), String(name)]}
          contentStyle={{ background: "var(--background)", border: "1px solid var(--chart-grid)", borderRadius: 8, fontSize: 13 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="incomeCents" name="Entradas" fill="var(--chart-income)" radius={[4, 4, 4, 4]} maxBarSize={28} />
        <Bar dataKey="expenseCents" name="Saídas" fill="var(--chart-expense)" radius={[4, 4, 4, 4]} maxBarSize={28} />
        <Line dataKey="resultCents" name="Resultado" stroke="var(--foreground)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
