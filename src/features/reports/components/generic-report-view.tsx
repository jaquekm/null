import type { ReportBlock, ReportTone } from "../lib/blocks";

function toneClass(tone?: ReportTone): string {
  if (tone === "emerald") return "text-emerald-600 dark:text-emerald-400";
  if (tone === "red") return "text-red-600 dark:text-red-400";
  return "text-black dark:text-zinc-50";
}

function barColor(status: string | null | undefined): string {
  if (status === "over") return "bg-red-500";
  if (status === "warning") return "bg-amber-500";
  return "bg-emerald-500";
}

/** Um bloco de relatório (6.2b) — renderizador genérico reutilizado por todo `kind` sem tela própria (só `finance_monthly` tem componente dedicado). */
function Block({ block }: { block: ReportBlock }) {
  if (block.kind === "cards") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {block.items.map((item, i) => (
          <div key={i} className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.label}</p>
            <p className={`text-lg font-semibold ${toneClass(item.tone)}`}>{item.value}</p>
          </div>
        ))}
      </div>
    );
  }

  if (block.kind === "list") {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">{block.title}</h2>
        {block.rows.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{block.emptyText ?? "Nada por aqui."}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {block.rows.map((row, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">
                  {row.label}
                  {row.sublabel && <span className="text-xs text-zinc-400 dark:text-zinc-500"> ({row.sublabel})</span>}
                </span>
                {row.value != null && <span className={`shrink-0 ${toneClass(row.tone)}`}>{row.value}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (block.kind === "bars") {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">{block.title}</h2>
        {block.rows.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{block.emptyText ?? "Nada por aqui."}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {block.rows.map((row, i) => (
              <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-black dark:text-zinc-50">{row.label}</span>
                  <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{row.valueLabel}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.08]">
                  <div className={`h-full rounded-full ${barColor(row.status)}`} style={{ width: `${Math.min(Math.max(row.percent, 0), 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (block.kind === "table") {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">{block.title}</h2>
        {block.rows.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{block.emptyText ?? "Nada por aqui."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[.08] dark:border-white/[.08]">
                  {block.columns.map((col) => (
                    <th key={col.key} className={`py-1.5 font-medium text-zinc-500 dark:text-zinc-400 ${col.align === "right" ? "text-right" : "text-left"}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} className="border-b border-black/[.04] dark:border-white/[.04]">
                    {block.columns.map((col) => (
                      <td key={col.key} className={`py-1.5 text-zinc-700 dark:text-zinc-300 ${col.align === "right" ? "text-right" : "text-left"}`}>
                        {row[col.key] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-1">
      {block.title && <h2 className="text-sm font-medium text-black dark:text-zinc-50">{block.title}</h2>}
      <p className="whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-300">{block.body}</p>
    </section>
  );
}

/** Tela genérica pra todo relatório sem componente dedicado (6.2b) — mesma linguagem visual de `finance-monthly-report.tsx`, parametrizada por `ReportBlock[]`. */
export function GenericReportView({ title, subtitle, blocks }: { title: string; subtitle: string; blocks: ReportBlock[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{title}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      </div>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}
