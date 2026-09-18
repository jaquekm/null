"use client";

import type { SidebarSpace } from "@/features/spaces/queries";
import { CaptureForm } from "./capture-form";

export function CaptureDialog({
  spaces,
  types,
  onClose,
}: {
  spaces: SidebarSpace[];
  types: { id: string; name: string }[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-24"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Captura rápida</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            ×
          </button>
        </div>
        <CaptureForm spaces={spaces} types={types} onDone={onClose} />
      </div>
    </div>
  );
}
