"use client";

import { Plus, Search } from "lucide-react";
import { useCaptureDialog } from "@/features/capture/components/capture-dialog-provider";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function TopBar({ email }: { email: string }) {
  const { open: openCapture } = useCaptureDialog();
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-black/[.08] bg-white/80 px-4 backdrop-blur dark:border-white/[.08] dark:bg-black/80">
      <div className="flex flex-1 items-center gap-2 rounded-full bg-black/[.04] px-3 py-1.5 text-sm text-zinc-500 dark:bg-white/[.06] dark:text-zinc-400">
        <Search className="h-4 w-4 shrink-0" />
        <input
          type="search"
          placeholder="Buscar... (em breve)"
          disabled
          className="w-full bg-transparent placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed dark:placeholder:text-zinc-500"
        />
      </div>

      <button
        type="button"
        onClick={openCapture}
        className="bg-foreground text-background flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
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
