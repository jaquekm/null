"use client";

import { X } from "lucide-react";
import type { FieldDefinition } from "@/features/types/schemas";
import type { SidebarSpace } from "@/features/spaces/queries";
import { automationActionTypes, type AutomationAction } from "../schemas";

const ACTION_LABELS: Record<(typeof automationActionTypes)[number], string> = {
  set_property: "Definir propriedade",
  add_tag: "Adicionar tag",
  remove_tag: "Remover tag",
  move_to_space: "Mover de espaço",
  create_item: "Criar item",
  create_checklist: "Adicionar checklist",
  create_reminder: "Criar lembrete",
  notify_me: "Notificar você",
  create_bill: "Criar conta",
  create_review_cards: "Criar flashcards de revisão",
  call_webhook: "Chamar webhook",
};

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

function defaultAction(type: (typeof automationActionTypes)[number]): AutomationAction {
  switch (type) {
    case "set_property":
      return { type, field: "", value: "" };
    case "add_tag":
      return { type, tag: "" };
    case "remove_tag":
      return { type, tag: "" };
    case "move_to_space":
      return { type, spaceId: null };
    case "create_item":
      return { type, typeId: "", title: "", properties: {}, linkToTrigger: false, parent: false };
    case "create_checklist":
      return { type, items: [""] };
    case "create_reminder":
      return { type, recipient: "me", offsetMinutes: 0, message: "" };
    case "notify_me":
      return { type, title: "", body: "" };
    case "create_bill":
      return { type, direction: "receivable", amountField: "", dueInDays: 7, description: "" };
    case "create_review_cards":
      return { type };
    case "call_webhook":
      return { type, url: "" };
  }
}

interface Props {
  action: AutomationAction;
  fields: FieldDefinition[];
  types: { id: string; name: string }[];
  spaces: SidebarSpace[];
  onChange: (action: AutomationAction) => void;
  onRemove: () => void;
}

/** Uma linha de "Então [ação]" (5.3) — campos específicos variam por tipo de ação. */
export function ActionFields({ action, fields, types, spaces, onChange, onRemove }: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
      <div className="flex items-center justify-between gap-2">
        <select value={action.type} onChange={(event) => onChange(defaultAction(event.target.value as (typeof automationActionTypes)[number]))} className={inputClassName}>
          {automationActionTypes.map((type) => (
            <option key={type} value={type}>
              {ACTION_LABELS[type]}
            </option>
          ))}
        </select>
        <button type="button" onClick={onRemove} aria-label="Remover ação" className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400">
          <X className="h-4 w-4" />
        </button>
      </div>

      {action.type === "set_property" && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={action.field} onChange={(event) => onChange({ ...action, field: event.target.value })} className={inputClassName}>
            <option value="">Campo...</option>
            {fields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">=</span>
          <input
            placeholder="valor (aceita {{today}}, {{today+7d}})"
            value={typeof action.value === "string" ? action.value : String(action.value ?? "")}
            onChange={(event) => onChange({ ...action, value: event.target.value })}
            className={`${inputClassName} min-w-0 flex-1`}
          />
        </div>
      )}

      {(action.type === "add_tag" || action.type === "remove_tag") && (
        <input placeholder="tag" value={action.tag} onChange={(event) => onChange({ ...action, tag: event.target.value })} className={inputClassName} />
      )}

      {action.type === "move_to_space" && (
        <select value={action.spaceId ?? ""} onChange={(event) => onChange({ ...action, spaceId: event.target.value || null })} className={inputClassName}>
          <option value="">Sem espaço</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
      )}

      {action.type === "create_item" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <select value={action.typeId} onChange={(event) => onChange({ ...action, typeId: event.target.value })} className={inputClassName}>
              <option value="">Tipo do novo item...</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Título (aceita {{title}}, {{campo}})"
              value={action.title}
              onChange={(event) => onChange({ ...action, title: event.target.value })}
              className={`${inputClassName} min-w-0 flex-1`}
            />
          </div>
          <div className="flex gap-4 text-xs text-zinc-600 dark:text-zinc-300">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={action.linkToTrigger} onChange={(event) => onChange({ ...action, linkToTrigger: event.target.checked })} />
              Vincular a este item
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={action.parent} onChange={(event) => onChange({ ...action, parent: event.target.checked })} />
              Criar como subitem
            </label>
          </div>
        </div>
      )}

      {action.type === "create_checklist" && (
        <div className="flex flex-col gap-1.5">
          {action.items.map((text, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <input
                value={text}
                onChange={(event) => {
                  const next = [...action.items];
                  next[index] = event.target.value;
                  onChange({ ...action, items: next });
                }}
                className={`${inputClassName} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={() => onChange({ ...action, items: action.items.filter((_, i) => i !== index) })}
                aria-label="Remover item"
                className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => onChange({ ...action, items: [...action.items, ""] })} className="self-start text-xs text-zinc-500 underline dark:text-zinc-400">
            Adicionar item
          </button>
        </div>
      )}

      {action.type === "create_reminder" && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={action.recipient}
            onChange={(event) => onChange({ ...action, recipient: event.target.value as "me" | "contact_field" })}
            className={inputClassName}
          >
            <option value="me">Pra você</option>
            <option value="contact_field">Pro contato de um campo</option>
          </select>
          {action.recipient === "contact_field" && (
            <select value={action.field ?? ""} onChange={(event) => onChange({ ...action, field: event.target.value })} className={inputClassName}>
              <option value="">Campo de contato...</option>
              {fields.filter((f) => f.type === "contact").map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
          <span className="text-xs text-zinc-500 dark:text-zinc-400">daqui (min)</span>
          <input
            type="number"
            value={action.offsetMinutes}
            onChange={(event) => onChange({ ...action, offsetMinutes: Number(event.target.value) })}
            className={`${inputClassName} w-20`}
          />
          <input
            placeholder="Mensagem"
            value={action.message}
            onChange={(event) => onChange({ ...action, message: event.target.value })}
            className={`${inputClassName} min-w-0 flex-1`}
          />
        </div>
      )}

      {action.type === "notify_me" && (
        <div className="flex flex-col gap-1.5">
          <input placeholder="Título" value={action.title} onChange={(event) => onChange({ ...action, title: event.target.value })} className={inputClassName} />
          <input placeholder="Corpo" value={action.body} onChange={(event) => onChange({ ...action, body: event.target.value })} className={inputClassName} />
        </div>
      )}

      {action.type === "create_bill" && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={action.direction} onChange={(event) => onChange({ ...action, direction: event.target.value as "payable" | "receivable" })} className={inputClassName}>
            <option value="receivable">A receber</option>
            <option value="payable">A pagar</option>
          </select>
          <select value={action.amountField} onChange={(event) => onChange({ ...action, amountField: event.target.value })} className={inputClassName}>
            <option value="">Campo de valor...</option>
            {fields.filter((f) => f.type === "money" || f.type === "number").map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <select value={action.contactField ?? ""} onChange={(event) => onChange({ ...action, contactField: event.target.value || undefined })} className={inputClassName}>
            <option value="">Sem contato</option>
            {fields.filter((f) => f.type === "contact").map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">vence em (dias)</span>
          <input type="number" value={action.dueInDays} onChange={(event) => onChange({ ...action, dueInDays: Number(event.target.value) })} className={`${inputClassName} w-20`} />
          <input
            placeholder="Descrição (aceita {{title}})"
            value={action.description}
            onChange={(event) => onChange({ ...action, description: event.target.value })}
            className={`${inputClassName} min-w-0 flex-1`}
          />
        </div>
      )}

      {action.type === "call_webhook" && (
        <input placeholder="URL do webhook (precisa estar na lista permitida)" value={action.url} onChange={(event) => onChange({ ...action, url: event.target.value })} className={inputClassName} />
      )}
    </div>
  );
}
