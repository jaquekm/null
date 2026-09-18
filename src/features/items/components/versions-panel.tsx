import type { ItemVersionRow } from "../queries";

const REASON_LABELS: Record<string, string> = {
  auto: "Automático",
  manual: "Manual",
  restore: "Restauração",
  ai: "IA",
};

export function VersionsPanel({ versions }: { versions: ItemVersionRow[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">Versões</h2>
      {versions.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma versão salva ainda.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {versions.map((version) => (
            <li key={version.id} className="flex items-center justify-between text-sm">
              <span className="truncate text-black dark:text-zinc-50">{version.title || "Sem título"}</span>
              <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                {REASON_LABELS[version.reason] ?? version.reason} ·{" "}
                {new Date(version.createdAt).toLocaleString("pt-BR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
