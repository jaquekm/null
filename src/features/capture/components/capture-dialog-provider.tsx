"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SidebarSpace } from "@/features/spaces/queries";
import { CaptureDialog } from "./capture-dialog";

interface CaptureDialogContextValue {
  open: (options?: { typeId?: string }) => void;
}

const CaptureDialogContext = createContext<CaptureDialogContextValue | null>(null);

export function useCaptureDialog(): CaptureDialogContextValue {
  const ctx = useContext(CaptureDialogContext);
  if (!ctx) throw new Error("useCaptureDialog precisa estar dentro de CaptureDialogProvider");
  return ctx;
}

/** Diálogo de captura (1.10): botão "+" e `Ctrl/Cmd+Shift+Espaço` abrem daqui, de qualquer página do app. */
export function CaptureDialogProvider({
  children,
  spaces,
  types,
}: {
  children: ReactNode;
  spaces: SidebarSpace[];
  types: { id: string; name: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialTypeId, setInitialTypeId] = useState<string | undefined>(undefined);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === "Space") {
        event.preventDefault();
        setInitialTypeId(undefined);
        setIsOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <CaptureDialogContext.Provider
      value={{
        open: (options) => {
          setInitialTypeId(options?.typeId);
          setIsOpen(true);
        },
      }}
    >
      {children}
      {isOpen && (
        <CaptureDialog spaces={spaces} types={types} initialTypeId={initialTypeId} onClose={() => setIsOpen(false)} />
      )}
    </CaptureDialogContext.Provider>
  );
}
