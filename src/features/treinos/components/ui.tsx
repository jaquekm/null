"use client";

import type { ReactNode } from "react";

export const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

export const cardClassName = "flex flex-col gap-3 rounded-xl border border-black/[.08] p-4 dark:border-white/[.08]";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
      {label}
      {children}
    </label>
  );
}

/** Escala 0–10 (dor). `allowEmpty`: "—" = ainda não informado. */
export function PainSelect({
  value,
  onChange,
  allowEmpty = false,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  allowEmpty?: boolean;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      className={inputClassName}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    >
      {allowEmpty && <option value="">—</option>}
      {Array.from({ length: 11 }, (_, i) => (
        <option key={i} value={i}>
          {i}
        </option>
      ))}
    </select>
  );
}

/** Grupo de botões de escolha única (treino A–D, energia 1–5). */
export function ChoiceButtons<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: T[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => (
        <button
          key={String(option)}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => onChange(option)}
          className={`rounded-lg border py-2 text-sm font-semibold ${
            option === value
              ? "border-transparent bg-brand text-brand-fg"
              : "border-black/[.12] hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.06]"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function formatShortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}
