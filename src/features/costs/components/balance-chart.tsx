"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/money";
import type { MonthBalance } from "../lib/monthly-balance";

function monthLabel(month: string): string {
  const label = format(new Date(`${month}-01T00:00:00`), "MMM/yy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function axisTick(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** Saldo mensal (7.8): economia de assinaturas canceladas × custos fixos do Hub × resultado. Só BRL — custos variáveis de IA ficam de fora (ver monthly-balance.ts). */
export function BalanceChart({ data }: { data: MonthBalance[] }) {
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
        <Bar dataKey="savingsCents" name="Economia" fill="var(--chart-income)" radius={[4, 4, 4, 4]} maxBarSize={28} />
        <Bar dataKey="costsCents" name="Custos" fill="var(--chart-expense)" radius={[4, 4, 4, 4]} maxBarSize={28} />
        <Line dataKey="balanceCents" name="Saldo" stroke="var(--foreground)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
