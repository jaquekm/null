"use client";

import { CalendarClock } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EXPIRY_ALERT_DAYS, expiryStatus, formatExpiry, type ExpiryLevel } from "@/features/documents/lib/expiry";
import { setItemExpiry } from "../actions";

const inputClassName =
  "w-full rounded-lg border border-black/[.08] bg-surface-muted px-3 py-2 text-sm transition-colors hover:border-black/[.16] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-60 dark:border-white/[.08] dark:hover:border-white/[.16]";

const EXPIRY_ALERTS_LABEL = `${EXPIRY_ALERT_DAYS.slice(0, -1).join(", ")} e ${EXPIRY_ALERT_DAYS.at(-1)} dia`;

const LEVEL_CLASS: Record<ExpiryLevel, string> = {
  expired: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  today: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  soon: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
};

/**
 * "Validade" de documento (9.5) — primeira célula da grade de propriedades.
 * Salvar agenda os avisos de 30, 7 e 1 dia antes. Se o texto de um anexo
 * (OCR) tiver uma data de validade, ela aparece como sugestão: só entra
 * quando a dona toca em "Usar essa data".
 */
export function ExpiryField({
  itemId,
  value,
  updatedAt,
  today,
  suggestion,
  onChange,
}: {
  itemId: string;
  value: string | null;
  updatedAt: string;
  /** Hoje no fuso da dona (vem do servidor, pra não divergir na hidratação). */
  today: string;
  suggestion: string | null;
  onChange: (value: string | null, updatedAt: string) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(next: string | null) {
    if (next === value) return;
    setError(null);
    setDraft(next ?? "");
    startTransition(async () => {
      const result = await setItemExpiry(itemId, updatedAt, next);
      if (!result.ok) {
        setError(result.error);
        setDraft(value ?? "");
        return;
      }
      onChange(next, result.data.updatedAt);
      if (next) {
        toast.success(
          result.data.alerts > 0
            ? `Validade salva — ${result.data.alerts === 1 ? "1 aviso agendado" : `${result.data.alerts} avisos agendados`} antes de vencer.`
            : "Validade salva.",
        );
      } else {
        toast.success("Validade removida e avisos cancelados.");
      }
    });
  }

  const status = value ? expiryStatus(value, today) : null;
  const showSuggestion = suggestion && suggestion !== value;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`expiry-${itemId}`} className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Validade
      </label>
      <input
        id={`expiry-${itemId}`}
        type="date"
        value={draft}
        disabled={pending}
        onChange={(e) => {
          setDraft(e.target.value);
          // O navegador só entrega o valor quando a data está completa (ou vazia).
          if (e.target.value === "" || /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) save(e.target.value || null);
        }}
        className={inputClassName}
      />
      {status && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span className={`rounded-full px-2 py-0.5 font-medium ${LEVEL_CLASS[status.level]}`}>{status.label}</span>
          {status.level === "ok" || status.level === "soon" ? <span>Avisos {EXPIRY_ALERTS_LABEL} antes, às 9h.</span> : null}
          <button type="button" onClick={() => save(null)} disabled={pending} className="text-zinc-400 underline-offset-2 hover:text-red-600 hover:underline">
            tirar validade
          </button>
        </p>
      )}
      {showSuggestion && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-200">
          Encontrei <strong className="font-semibold">{formatExpiry(suggestion)}</strong> no anexo.
          <button type="button" onClick={() => save(suggestion)} disabled={pending} className="font-medium text-brand-text hover:underline">
            Usar essa data
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
