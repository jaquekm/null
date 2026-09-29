"use client";

import { Plus, Search } from "lucide-react";
import { useCaptureDialog } from "@/features/capture/components/capture-dialog-provider";
import { useCommandPalette } from "@/features/command-palette/components/command-palette-provider";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function TopBar({ email }: { email: string }) {
  const { open: openCapture } = useCaptureDialog();
  const { open: openPalette } = useCommandPalette();
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-black/[.06] bg-background/70 px-4 backdrop-blur-md dark:border-white/[.06]">
      <button
        type="button"
        onClick={openPalette}
        className="flex min-w-0 max-w-xl flex-1 items-center gap-2 rounded-xl border border-black/[.06] bg-surface px-3 py-2 text-left text-sm text-zinc-500 shadow-sm hover:border-black/[.12] dark:border-white/[.08] dark:text-zinc-400 dark:hover:border-white/[.16]"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">Buscar ou executar um comando...</span>
        <kbd className="hidden shrink-0 rounded border border-black/[.12] px-1.5 py-0.5 text-xs text-zinc-400 sm:inline dark:border-white/[.16]">
          Ctrl K
        </kbd>
      </button>

      <button
        type="button"
        onClick={() => openCapture()}
        className="bg-brand text-brand-fg ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-md shadow-violet-600/25 transition-colors hover:bg-brand-hover"
        aria-label="Capturar"
        title="Capturar (Ctrl/Cmd+Shift+Espaço)"
      >
        <Plus className="h-5 w-5" />
      </button>

      <ThemeToggle />
      <UserMenu email={email} />
    </header>
  );
}
