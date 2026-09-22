"use client";

import type { FieldDefinition } from "@/features/types/schemas";
import { automationTriggerTypes, type AutomationTrigger } from "../schemas";

const TRIGGER_LABELS: Record<(typeof automationTriggerTypes)[number], string> = {
  item_created: "Item criado",
  property_changed: "Propriedade mudou",
  status_changed: "Status mudou",
  date_reached: "Data de um campo chegou",
  no_activity: "Item sem atividade há N dias",
  schedule: "Horário recorrente",
  tag_added: "Tag adicionada",
};

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

function defaultTrigger(type: (typeof automationTriggerTypes)[number]): AutomationTrigger {
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
      return { type, rrule: "FREQ=WEEKLY;BYDAY=MO", timezone: "America/Sao_Paulo" };
    case "tag_added":
      return { type, tag: "" };
  }
}

/** "Quando [gatilho]" (5.3) — campos específicos variam por tipo de gatilho. */
export function TriggerFields({ trigger, fields, onChange }: { trigger: AutomationTrigger; fields: FieldDefinition[]; onChange: (trigger: AutomationTrigger) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-black dark:text-zinc-50">Quando</span>
      <select value={trigger.type} onChange={(event) => onChange(defaultTrigger(event.target.value as (typeof automationTriggerTypes)[number]))} className={inputClassName}>
        {automationTriggerTypes.map((type) => (
          <option key={type} value={type}>
            {TRIGGER_LABELS[type]}
          </option>
        ))}
      </select>

      {trigger.type === "property_changed" && (
        <>
          <select value={trigger.field} onChange={(event) => onChange({ ...trigger, field: event.target.value })} className={inputClassName}>
            <option value="">Escolha o campo...</option>
            {fields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">pra</span>
          <input
            placeholder="qualquer valor"
            value={typeof trigger.to === "string" ? trigger.to : ""}
            onChange={(event) => onChange({ ...trigger, to: event.target.value || undefined })}
            className={`${inputClassName} w-40`}
          />
        </>
      )}

      {trigger.type === "status_changed" && (
        <select value={trigger.to} onChange={(event) => onChange({ ...trigger, to: event.target.value })} className={inputClassName}>
          <option value="inbox">Inbox</option>
          <option value="active">Ativo</option>
          <option value="archived">Arquivado</option>
        </select>
      )}

      {trigger.type === "date_reached" && (
        <>
          <select value={trigger.field} onChange={(event) => onChange({ ...trigger, field: event.target.value })} className={inputClassName}>
            <option value="">Escolha o campo de data...</option>
            {fields
              .filter((field) => field.type === "date" || field.type === "datetime")
              .map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
          </select>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">deslocamento (min)</span>
          <input
            type="number"
            value={trigger.offsetMinutes}
            onChange={(event) => onChange({ ...trigger, offsetMinutes: Number(event.target.value) })}
            className={`${inputClassName} w-24`}
          />
        </>
      )}

      {trigger.type === "no_activity" && (
        <>
          <input type="number" min={1} value={trigger.days} onChange={(event) => onChange({ ...trigger, days: Number(event.target.value) })} className={`${inputClassName} w-20`} />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">dias sem atualização (do item ou de itens ligados)</span>
        </>
      )}

      {trigger.type === "schedule" && (
        <>
          <input placeholder="RRULE (ex.: FREQ=WEEKLY;BYDAY=MO)" value={trigger.rrule} onChange={(event) => onChange({ ...trigger, rrule: event.target.value })} className={`${inputClassName} w-64`} />
          <input placeholder="Fuso" value={trigger.timezone} onChange={(event) => onChange({ ...trigger, timezone: event.target.value })} className={`${inputClassName} w-40`} />
        </>
      )}

      {trigger.type === "tag_added" && <input placeholder="tag" value={trigger.tag} onChange={(event) => onChange({ ...trigger, tag: event.target.value })} className={inputClassName} />}
    </div>
  );
}
