"use client";

import { useState } from "react";
import type { FieldDefinition } from "@/features/types/schemas";
import { describeScheduleRrule, scheduleFromPhrase } from "../lib/schedule-phrase";
import { automationTriggerTypes, type AutomationTrigger } from "../schemas";
import { DurationInput } from "./duration-input";

/** Opções do "Quando…" no português de uso (9.8). */
const TRIGGER_LABELS: Record<(typeof automationTriggerTypes)[number], string> = {
  item_created: "um item for criado",
  property_changed: "um campo mudar",
  status_changed: "o status de um item mudar",
  date_reached: "chegar a data de um campo",
  no_activity: "um item ficar parado",
  schedule: "chegar um horário que se repete",
  tag_added: "um item ganhar uma tag",
};

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

function defaultTrigger(type: (typeof automationTriggerTypes)[number], timezone: string): AutomationTrigger {
  switch (type) {
    case "item_created":
      return { type };
    case "property_changed":
      return { type, field: "" };
    case "status_changed":
      return { type, to: "active" };
    case "date_reached":
      return { type, field: "", offsetMinutes: 0 };
    case "no_activity":
      return { type, days: 7 };
    case "schedule":
      return { type, rrule: "", timezone };
    case "tag_added":
      return { type, tag: "" };
  }
}

/** "toda sexta às 17h" → RRULE, com a prévia do que foi entendido (9.8). O RRULE cru fica em "Avançado". */
function ScheduleFields({ trigger, timezone, onChange }: { trigger: Extract<AutomationTrigger, { type: "schedule" }>; timezone: string; onChange: (trigger: AutomationTrigger) => void }) {
  const [text, setText] = useState(() => (trigger.rrule ? (describeScheduleRrule(trigger.rrule) ?? "") : ""));
  const [error, setError] = useState<string | null>(null);
  const understood = trigger.rrule ? describeScheduleRrule(trigger.rrule) : null;

  function handleText(value: string) {
    setText(value);
    const result = scheduleFromPhrase(value, new Date(), timezone);
    if (result.ok) {
      setError(null);
      onChange({ ...trigger, rrule: result.rrule, timezone });
    } else {
      setError(value.trim() ? result.error : null);
      onChange({ ...trigger, rrule: "" });
    }
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <input
        aria-label="Quando repete"
        placeholder="toda sexta às 17h · todo dia 10 · de segunda a sexta às 7h"
        value={text}
        onChange={(event) => handleText(event.target.value)}
        className={`${inputClassName} w-full`}
      />
      {understood && !error && <p className="text-xs text-emerald-700 dark:text-emerald-400">Entendi: {understood}.</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <details className="text-xs text-zinc-500 dark:text-zinc-400">
        <summary className="cursor-pointer select-none">Avançado (RRULE)</summary>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input
            aria-label="RRULE"
            placeholder="FREQ=WEEKLY;BYDAY=MO"
            value={trigger.rrule}
            onChange={(event) => onChange({ ...trigger, rrule: event.target.value })}
            className={`${inputClassName} min-w-0 flex-1 font-mono text-xs`}
          />
          <input aria-label="Fuso" value={trigger.timezone} onChange={(event) => onChange({ ...trigger, timezone: event.target.value })} className={`${inputClassName} w-44 text-xs`} />
        </div>
      </details>
    </div>
  );
}

/** "Quando [gatilho]" (5.3) — campos específicos variam por tipo de gatilho; opções em português de uso (9.8). */
export function TriggerFields({
  trigger,
  fields,
  timezone = "America/Sao_Paulo",
  onChange,
}: {
  trigger: AutomationTrigger;
  fields: FieldDefinition[];
  timezone?: string;
  onChange: (trigger: AutomationTrigger) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-black dark:text-zinc-50">Quando</span>
      <select
        aria-label="Quando"
        value={trigger.type}
        onChange={(event) => onChange(defaultTrigger(event.target.value as (typeof automationTriggerTypes)[number], timezone))}
        className={inputClassName}
      >
        {automationTriggerTypes.map((type) => (
          <option key={type} value={type}>
            {TRIGGER_LABELS[type]}
          </option>
        ))}
      </select>

      {trigger.type === "property_changed" && (
        <>
          <select aria-label="Campo" value={trigger.field} onChange={(event) => onChange({ ...trigger, field: event.target.value })} className={inputClassName}>
            <option value="">qual campo?</option>
            {fields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">para</span>
          <input
            aria-label="Novo valor"
            placeholder="qualquer valor"
            value={typeof trigger.to === "string" ? trigger.to : ""}
            onChange={(event) => onChange({ ...trigger, to: event.target.value || undefined })}
            className={`${inputClassName} w-40`}
          />
        </>
      )}

      {trigger.type === "status_changed" && (
        <>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">para</span>
          <select aria-label="Status" value={trigger.to} onChange={(event) => onChange({ ...trigger, to: event.target.value })} className={inputClassName}>
            <option value="inbox">Inbox</option>
            <option value="active">Ativo</option>
            <option value="archived">Arquivado</option>
          </select>
        </>
      )}

      {trigger.type === "date_reached" && (
        <>
          <select aria-label="Campo de data" value={trigger.field} onChange={(event) => onChange({ ...trigger, field: event.target.value })} className={inputClassName}>
            <option value="">qual data?</option>
            {fields
              .filter((field) => field.type === "date" || field.type === "datetime")
              .map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
          </select>
          <DurationInput minutes={trigger.offsetMinutes} relative onChange={(offsetMinutes) => onChange({ ...trigger, offsetMinutes })} />
        </>
      )}

      {trigger.type === "no_activity" && (
        <>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">por</span>
          <input
            aria-label="Dias parado"
            type="number"
            min={1}
            value={trigger.days}
            onChange={(event) => onChange({ ...trigger, days: Number(event.target.value) })}
            className={`${inputClassName} w-20`}
          />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">dias sem mudanças (nele ou nos itens ligados)</span>
        </>
      )}

      {trigger.type === "schedule" && <ScheduleFields trigger={trigger} timezone={timezone} onChange={onChange} />}

      {trigger.type === "tag_added" && (
        <input aria-label="Tag" placeholder="qual tag? ex.: urgente" value={trigger.tag} onChange={(event) => onChange({ ...trigger, tag: event.target.value })} className={inputClassName} />
      )}
    </div>
  );
}
