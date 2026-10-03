"use client";

import { CircleHelp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PAGE_HELP, type PageHelpTopic } from "@/lib/page-help";

/**
 * Botão "Como funciona" ao lado do título de cada módulo — abre por toque
 * (no celular não existe passar o mouse, então `title` nunca aparecia).
 */
export function PageHelp({ topic }: { topic: PageHelpTopic }) {
  const help = PAGE_HELP[topic];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-8 items-center gap-1 rounded-full border border-black/[.1] px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-black/[.04] dark:border-white/[.14] dark:text-zinc-300 dark:hover:bg-white/[.06]"
      >
        <CircleHelp className="h-4 w-4" aria-hidden />
        Como funciona
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`Como funciona: ${help.title}`}
          className="absolute left-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-black/[.08] bg-white p-4 text-sm shadow-xl dark:border-white/[.1] dark:bg-zinc-900"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="font-semibold text-black dark:text-zinc-50">{help.title}</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="-m-1 rounded-full p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-zinc-600 dark:text-zinc-300">
            {help.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
