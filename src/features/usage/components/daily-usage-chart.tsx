const formatUsd = (value: number) => `$${value.toFixed(2)}`;

/** Gráfico de barras simples, sem lib de gráfico (só CSS) — uma barra por dia do mês. */
export function DailyUsageChart({ daily }: { daily: { date: string; usd: number }[] }) {
  const max = Math.max(...daily.map((d) => d.usd), 0.01);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-28 items-end gap-0.5">
        {daily.map((day) => (
          <div key={day.date} title={`${day.date}: ${formatUsd(day.usd)}`} className="flex h-full flex-1 flex-col justify-end">
            <div
              className="min-h-[2px] rounded-t bg-black/70 dark:bg-white/70"
              style={{ height: `${(day.usd / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
        <span>{daily[0]?.date}</span>
        <span>{daily[daily.length - 1]?.date}</span>
      </div>
    </div>
  );
}
