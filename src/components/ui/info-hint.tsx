"use client";

import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Explicação por toque/clique — ao contrário de `title`, funciona no celular
 * (toque não dispara `:hover`, então um tooltip nativo nunca aparece lá).
 * Usar ao lado de controles cujo efeito não é óbvio pelo rótulo/ícone.
 */
export function InfoHint({ text, label = "Ajuda" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={label}
        aria-expanded={open}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-1.5 w-56 -translate-x-1/2 text-pretty rounded-lg border border-black/[.08] bg-white p-2.5 text-xs leading-snug text-zinc-600 shadow-lg dark:border-white/[.08] dark:bg-zinc-900 dark:text-zinc-300"
        >
          {text}
        </span>
      )}
    </span>
  );
}
