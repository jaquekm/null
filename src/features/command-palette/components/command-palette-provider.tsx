"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SidebarSpace } from "@/features/spaces/queries";
import { CommandPalette } from "./command-palette";

interface CommandPaletteContextValue {
  open: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette precisa estar dentro de CommandPaletteProvider");
  return ctx;
}

/** Paleta de comandos (1.16): `Ctrl/Cmd+K` abre daqui, de qualquer página do app. */
export function CommandPaletteProvider({
  children,
  spaces,
  types,
}: {
  children: ReactNode;
  spaces: SidebarSpace[];
  types: { id: string; name: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      <CommandPalette open={isOpen} onOpenChange={setIsOpen} spaces={spaces} types={types} />
    </CommandPaletteContext.Provider>
  );
}
