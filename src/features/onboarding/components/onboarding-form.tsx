"use client";

import { useId, useState } from "react";
import { useActionState } from "react";
import type { Result } from "@/lib/result";
import { completeOnboarding } from "../actions";

interface SpaceRowState {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const COLOR_TOKENS = ["slate", "red", "amber", "emerald", "teal", "sky", "blue", "violet", "rose"];

const SUGGESTED_SPACES: Omit<SpaceRowState, "id">[] = [
  { name: "Pessoal", icon: "🏠", color: "sky" },
  { name: "Trabalho", icon: "💼", color: "amber" },
  { name: "Estudos", icon: "📚", color: "violet" },
  { name: "Finanças da casa", icon: "💰", color: "emerald" },
  { name: "Ideias", icon: "💡", color: "rose" },
];

const TIMEZONE_OPTIONS = [
  { value: "America/Sao_Paulo", label: "Brasília (São Paulo, Rio, Sul, Nordeste)" },
  { value: "America/Manaus", label: "Manaus" },
  { value: "America/Belem", label: "Belém" },
  { value: "America/Rio_Branco", label: "Rio Branco" },
  { value: "America/Noronha", label: "Fernando de Noronha" },
];

const initialState: Result<null> = { ok: true, data: null };

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

function newRow(base?: Omit<SpaceRowState, "id">): SpaceRowState {
  return {
    id: crypto.randomUUID(),
    name: base?.name ?? "",
    icon: base?.icon ?? "✨",
    color: base?.color ?? "slate",
  };
}

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState);
  const [rows, setRows] = useState<SpaceRowState[]>(() => SUGGESTED_SPACES.map(newRow));
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const formId = useId();

  function updateRow(id: string, patch: Partial<SpaceRowState>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function addRow() {
    setRows((current) => [...current, newRow()]);
  }

  const spacesJson = JSON.stringify(
    rows
      .map((row) => ({ name: row.name.trim(), icon: row.icon, color: row.color }))
      .filter((row) => row.name.length > 0),
  );

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="spacesJson" value={spacesJson} />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-medium text-black dark:text-zinc-50">Espaços</h2>
          <p className="text-sm text-black/60 dark:text-white/60">
            Remova os que não fizerem sentido, edite o nome, emoji ou cor, e adicione outros (ex.: o nome de uma
            empresa).
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2">
              <input
                aria-label="Emoji ou ícone"
                value={row.icon}
                onChange={(e) => updateRow(row.id, { icon: e.target.value })}
                className={`${inputClassName} w-14 text-center`}
                maxLength={4}
              />
              <input
                aria-label="Nome do espaço"
                value={row.name}
                onChange={(e) => updateRow(row.id, { name: e.target.value })}
                className={`${inputClassName} min-w-0 flex-1`}
                maxLength={80}
              />
              <select
                aria-label="Cor"
                value={row.color}
                onChange={(e) => updateRow(row.id, { color: e.target.value })}
                className={inputClassName}
              >
                {COLOR_TOKENS.map((token) => (
                  <option key={token} value={token}>
                    {token}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                aria-label={`Remover ${row.name || "espaço"}`}
                className="rounded-lg border border-black/[.12] px-2.5 py-2 text-sm text-black/60 hover:bg-black/[.04] dark:border-white/[.16] dark:text-white/60 dark:hover:bg-white/[.06]"
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={addRow}
          className="self-start rounded-lg border border-dashed border-black/[.2] px-3 py-2 text-sm text-black/70 hover:bg-black/[.04] dark:border-white/[.24] dark:text-white/70 dark:hover:bg-white/[.06]"
        >
          + Adicionar espaço
        </button>
      </section>

      <section className="flex flex-col gap-1.5">
        <label htmlFor={`${formId}-timezone`} className="text-sm font-medium text-black dark:text-zinc-50">
          Fuso horário
        </label>
        <select
          id={`${formId}-timezone`}
          name="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className={inputClassName}
        >
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </section>

      {!state.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {pending ? "Configurando..." : "Começar a usar"}
      </button>
    </form>
  );
}
