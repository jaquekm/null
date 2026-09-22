"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/money";
import type { CategorySpendComparison } from "../lib/category-spend-comparison";

function axisTick(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** "Gastos por categoria... com comparação ao mês anterior" (4.12) — barras horizontais, atual (forte) × anterior (fraco). */
export function CategoryBreakdownChart({ data }: { data: CategorySpendComparison[] }) {
  const height = Math.max(160, data.length * 36 + 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
        <XAxis type="number" tickFormatter={axisTick} tick={{ fill: "var(--chart-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="categoryName" width={110} tick={{ fill: "var(--foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value, name) => [formatBRL(Number(value ?? 0)), String(name)]}
          contentStyle={{ background: "var(--background)", border: "1px solid var(--chart-grid)", borderRadius: 8, fontSize: 13 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="currentCents" name="Este mês" fill="var(--foreground)" radius={[0, 4, 4, 0]} maxBarSize={16} />
        <Bar dataKey="previousCents" name="Mês anterior" fill="var(--chart-muted)" radius={[0, 4, 4, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}
