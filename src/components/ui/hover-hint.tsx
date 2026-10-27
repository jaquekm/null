"use client";

import { cloneElement, useEffect, useId, useRef, useState, type ReactElement } from "react";

/**
 * Explicação que aparece quando o mouse fica parado em cima do controle (ou ele recebe
 * foco pelo teclado) por um instante — sem ícone ao lado, pra não poluir a tela.
 * Some ao tirar o mouse, ao clicar, ao perder o foco ou com Esc. No celular não existe
 * "mouse parado": quem precisa da explicação lá usa `InfoHint` (toque) ou o botão "Como funciona".
 */
export function HoverHint({
  text,
  children,
  delayMs = 600,
}: {
  text: string;
  /** Um único controle (botão, link…) — ganha `aria-describedby` enquanto a dica está aberta. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  delayMs?: number;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  function schedule() {
    clear();
    timer.current = setTimeout(() => setOpen(true), delayMs);
  }
  function hide() {
    clear();
    setOpen(false);
  }

  useEffect(() => clear, []);

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={(e) => {
        // Toque não tem "passar o mouse": só mouse e caneta.
        if (e.pointerType !== "touch") schedule();
      }}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={schedule}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === "Escape") hide();
      }}
    >
      {cloneElement(children, { "aria-describedby": open ? id : undefined })}
      {open && (
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-56 max-w-[calc(100vw-2rem)] text-pretty rounded-lg border border-black/[.08] bg-white p-2.5 text-xs font-normal leading-snug text-zinc-600 shadow-lg dark:border-white/[.08] dark:bg-zinc-900 dark:text-zinc-300"
        >
          {text}
        </span>
      )}
    </span>
  );
}
