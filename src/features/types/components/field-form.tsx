"use client";

import { useActionState, useState } from "react";
import type { Result } from "@/lib/result";
import { addField, updateField } from "../actions";
import { fieldTypes, type FieldDefinition, type FieldType } from "../schemas";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto curto",
  long_text: "Texto longo",
  number: "Número",
  money: "Dinheiro",
  percent: "Porcentagem",
  date: "Data",
  datetime: "Data e hora",
  select: "Seleção única",
  multi_select: "Seleção múltipla",
  checkbox: "Caixa de marcação",
  url: "URL",
  email: "E-mail",
  phone: "Telefone",
  rating: "Avaliação (estrelas)",
  relation: "Relação com outro item",
  contact: "Contato",
  file: "Arquivo",
  duration: "Duração",
};

const HAS_OPTIONS: FieldType[] = ["select", "multi_select"];
const HAS_RANGE: FieldType[] = ["number", "percent", "rating"];
const HAS_RELATION_TYPE: FieldType[] = ["relation"];
const HAS_MULTIPLE: FieldType[] = ["relation", "contact", "file"];
const HAS_CURRENCY: FieldType[] = ["money"];

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

interface OptionDraft {
  id: string;
  label: string;
  color?: string;
}

const initialState: Result<null> = { ok: true, data: null };

export function FieldForm({
  typeId,
  existingField,
  otherTypes,
  onCancel,
  onSaved,
}: {
  typeId: string;
  existingField?: FieldDefinition;
  otherTypes: { id: string; name: string }[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const action = existingField ? updateField.bind(null, typeId, existingField.key) : addField.bind(null, typeId);
  const [state, formAction, pending] = useActionState(action, initialState);

  const [fieldType, setFieldType] = useState<FieldType>(existingField?.type ?? "text");
  const [options, setOptions] = useState<OptionDraft[]>(
    existingField?.options ?? [
      { id: crypto.randomUUID(), label: "" },
      { id: crypto.randomUUID(), label: "" },
    ],
  );

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.ok) onSaved();
  }

  function updateOption(id: string, label: string) {
    setOptions((current) => current.map((o) => (o.id === id ? { ...o, label } : o)));
  }
  function removeOption(id: string) {
    setOptions((current) => current.filter((o) => o.id !== id));
  }
  function addOption() {
    setOptions((current) => [...current, { id: crypto.randomUUID(), label: "" }]);
  }

  const optionsJson = JSON.stringify(options.filter((o) => o.label.trim().length > 0));

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
      <div className="flex flex-wrap gap-2">
        <input
          name="label"
          defaultValue={existingField?.label}
          placeholder="Nome do campo"
          required
          maxLength={80}
          className={`${inputClassName} min-w-0 flex-1`}
        />
        <select
          name="type"
          value={fieldType}
          onChange={(e) => setFieldType(e.target.value as FieldType)}
          className={inputClassName}
        >
          {fieldTypes.map((type) => (
            <option key={type} value={type}>
              {FIELD_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      <input
        name="description"
        defaultValue={existingField?.description}
        placeholder="Descrição (opcional)"
        maxLength={300}
        className={inputClassName}
      />

      {HAS_OPTIONS.includes(fieldType) && (
        <div className="flex flex-col gap-1.5">
          <input type="hidden" name="optionsJson" value={optionsJson} />
          {options.map((option) => (
            <div key={option.id} className="flex gap-1.5">
              <input
                value={option.label}
                onChange={(e) => updateOption(option.id, e.target.value)}
                placeholder="Opção"
                className={`${inputClassName} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={() => removeOption(option.id)}
                aria-label="Remover opção"
                className="rounded-lg border border-black/[.12] px-2.5 text-sm text-zinc-500 hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-400 dark:hover:bg-white/[.06]"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="self-start text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            + Adicionar opção
          </button>
        </div>
      )}

      {HAS_RANGE.includes(fieldType) && (
        <div className="flex gap-2">
          <input
            name="min"
            type="number"
            defaultValue={existingField?.min}
            placeholder="Mínimo"
            className={`${inputClassName} w-28`}
          />
          <input
            name="max"
            type="number"
            defaultValue={existingField?.max}
            placeholder="Máximo"
            className={`${inputClassName} w-28`}
          />
        </div>
      )}

      {HAS_CURRENCY.includes(fieldType) && (
        <input
          name="currency"
          defaultValue={existingField?.currency ?? "BRL"}
          placeholder="Moeda (ex.: BRL)"
          maxLength={10}
          className={`${inputClassName} w-28`}
        />
      )}

      {HAS_RELATION_TYPE.includes(fieldType) && (
        <select name="relationTypeId" defaultValue={existingField?.relationTypeId ?? ""} className={inputClassName}>
          <option value="">Qualquer tipo</option>
          {otherTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-zinc-700 dark:text-zinc-200">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="required" defaultChecked={existingField?.required} />
          Obrigatório
        </label>
        {HAS_MULTIPLE.includes(fieldType) && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="multiple" defaultChecked={existingField?.multiple} />
            Permitir vários
          </label>
        )}
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="showInCard" defaultChecked={existingField?.showInCard} />
          Mostrar no card do kanban
        </label>
      </div>

      {!state.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-foreground text-background rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Salvando..." : "Salvar campo"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
