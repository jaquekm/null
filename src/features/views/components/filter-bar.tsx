"use client";

import { Plus, X } from "lucide-react";
import type { FieldDefinition } from "@/features/types/schemas";
import { FILTER_OPERATOR_LABELS, type FilterOperator, type ViewFilter } from "../schemas";
import { isCommonField, operatorsForCommonField, operatorsForFieldType } from "../lib/field-operators";

const STATUS_OPTIONS = [
  { id: "inbox", label: "Inbox" },
  { id: "active", label: "Ativo" },
  { id: "archived", label: "Arquivado" },
];

const NUMBER_FIELD_TYPES = new Set<FieldDefinition["type"]>(["number", "percent", "rating", "money", "duration"]);

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

interface FilterableField {
  key: string;
  label: string;
}

/** Editor de filtros por campo (1.15) — operadores variam por tipo de campo, valor varia por operador. */
export function FilterBar({
  filters,
  fields,
  onChange,
}: {
  filters: ViewFilter[];
  fields: FieldDefinition[];
  onChange: (filters: ViewFilter[]) => void;
}) {
  const filterableFields: FilterableField[] = [
    { key: "title", label: "Título" },
    { key: "status", label: "Status" },
    { key: "updated_at", label: "Atualizado em" },
    { key: "created_at", label: "Criado em" },
    ...fields.filter((field) => !field.hidden).map((field) => ({ key: field.key, label: field.label })),
  ];

  function updateFilter(index: number, patch: Partial<ViewFilter>) {
    onChange(filters.map((filter, i) => (i === index ? { ...filter, ...patch } : filter)));
  }

  function addFilter() {
    const first = filterableFields[0];
    if (!first) return;
    onChange([...filters, { field: first.key, op: "contains", value: "" }]);
  }

  function removeFilter(index: number) {
    onChange(filters.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      {filters.map((filter, index) => (
        <FilterRow
          key={index}
          filter={filter}
          fields={fields}
          filterableFields={filterableFields}
          onChange={(patch) => updateFilter(index, patch)}
          onRemove={() => removeFilter(index)}
        />
      ))}
      <button
        type="button"
        onClick={addFilter}
        className="flex items-center gap-1 self-start text-xs text-zinc-500 hover:underline dark:text-zinc-400"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar filtro
      </button>
    </div>
  );
}

function FilterRow({
  filter,
  fields,
  filterableFields,
  onChange,
  onRemove,
}: {
  filter: ViewFilter;
  fields: FieldDefinition[];
  filterableFields: FilterableField[];
  onChange: (patch: Partial<ViewFilter>) => void;
  onRemove: () => void;
}) {
  const fieldDef = fields.find((field) => field.key === filter.field);
  const operators = isCommonField(filter.field)
    ? operatorsForCommonField(filter.field)
    : fieldDef
      ? operatorsForFieldType(fieldDef.type)
      : [];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={filter.field}
        onChange={(e) => onChange({ field: e.target.value, op: "contains", value: "" })}
        className={inputClassName}
      >
        {filterableFields.map((field) => (
          <option key={field.key} value={field.key}>
            {field.label}
          </option>
        ))}
      </select>
      <select
        value={filter.op}
        onChange={(e) => onChange({ op: e.target.value as FilterOperator, value: undefined })}
        className={inputClassName}
      >
        {operators.map((op) => (
          <option key={op} value={op}>
            {FILTER_OPERATOR_LABELS[op]}
          </option>
        ))}
      </select>
      <FilterValueInput filter={filter} fieldDef={fieldDef} onChange={(value) => onChange({ value })} />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remover filtro"
        className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FilterValueInput({
  filter,
  fieldDef,
  onChange,
}: {
  filter: ViewFilter;
  fieldDef?: FieldDefinition;
  onChange: (value: unknown) => void;
}) {
  if (filter.op === "empty" || filter.op === "not_empty") return null;

  if (filter.field === "status") {
    return <OptionValueInput filter={filter} options={STATUS_OPTIONS} onChange={onChange} />;
  }

  if (fieldDef?.type === "select" || fieldDef?.type === "multi_select") {
    return <OptionValueInput filter={filter} options={fieldDef.options ?? []} onChange={onChange} />;
  }

  if (fieldDef?.type === "checkbox") {
    return (
      <select
        value={filter.value === true ? "true" : filter.value === false ? "false" : ""}
        onChange={(e) => onChange(e.target.value === "true")}
        className={inputClassName}
      >
        <option value="">—</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    );
  }

  const isDateField = fieldDef?.type === "date" || filter.field === "updated_at" || filter.field === "created_at";
  const isNumberField = fieldDef && NUMBER_FIELD_TYPES.has(fieldDef.type);
  const inputType = isDateField ? "date" : isNumberField ? "number" : "text";

  if (filter.op === "between") {
    const [from, to] = Array.isArray(filter.value) ? filter.value : ["", ""];
    return (
      <div className="flex items-center gap-1">
        <input
          type={inputType}
          value={(from as string | number | undefined) ?? ""}
          onChange={(e) => onChange([e.target.value, to])}
          className={`${inputClassName} w-24`}
        />
        <span className="text-xs text-zinc-400 dark:text-zinc-500">e</span>
        <input
          type={inputType}
          value={(to as string | number | undefined) ?? ""}
          onChange={(e) => onChange([from, e.target.value])}
          className={`${inputClassName} w-24`}
        />
      </div>
    );
  }

  if (filter.op === "any_of") {
    return (
      <input
        type="text"
        placeholder="valor1, valor2..."
        value={Array.isArray(filter.value) ? (filter.value as string[]).join(", ") : ""}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          )
        }
        className={`${inputClassName} w-40`}
      />
    );
  }

  return (
    <input
      type={inputType}
      value={typeof filter.value === "string" || typeof filter.value === "number" ? filter.value : ""}
      onChange={(e) => onChange(inputType === "number" ? Number(e.target.value) : e.target.value)}
      className={inputClassName}
    />
  );
}

function OptionValueInput({
  filter,
  options,
  onChange,
}: {
  filter: ViewFilter;
  options: { id: string; label: string }[];
  onChange: (value: unknown) => void;
}) {
  if (filter.op === "any_of") {
    const selected = Array.isArray(filter.value) ? (filter.value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <label key={option.id} className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  const next = e.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id);
                  onChange(next);
                }}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <select
      value={typeof filter.value === "string" ? filter.value : ""}
      onChange={(e) => onChange(e.target.value)}
      className={inputClassName}
    >
      <option value="">—</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
