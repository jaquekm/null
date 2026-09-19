import { SHORTCUT_GROUPS } from "@/features/command-palette/lib/shortcuts";

export default function AtalhosPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Atalhos de teclado</h1>
        <p className="text-sm text-black/60 dark:text-white/60">Todos os atalhos disponíveis no Hub.</p>
      </div>

      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">{group.title}</h2>
          <div className="flex flex-col divide-y divide-black/[.08] rounded-lg border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.08]">
            {group.shortcuts.map((shortcut) => (
              <div
                key={shortcut.description}
                className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
              >
                <span className="text-zinc-600 dark:text-zinc-300">{shortcut.description}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {shortcut.keys.map((key) => (
                    <kbd
                      key={key}
                      className="rounded border border-black/[.12] bg-black/[.03] px-1.5 py-0.5 text-xs text-zinc-600 dark:border-white/[.16] dark:bg-white/[.06] dark:text-zinc-300"
                    >
                      {key}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
