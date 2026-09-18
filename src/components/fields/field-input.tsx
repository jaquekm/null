"use client";

import { useActionState, useState } from "react";
import { updateItemProperty } from "@/features/items/actions";
import type { Result } from "@/lib/result";
import type { FieldDefinition } from "@/features/types/schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const initialState: Result<{ updatedAt: string } | null> = { ok: true, data: null };

const NOT_YET_EDITABLE: FieldDefinition["type"][] = ["relation", "contact", "file"];

export function FieldInput({
  itemId,
  field,
  value,
  updatedAt,
  onSaved,
}: {
  itemId: string;
  field: FieldDefinition;
  value: unknown;
  updatedAt: string;
  onSaved: (updatedAt: string) => void;
}) {
  const action = updateItemProperty.bind(null, itemId, field.key, updatedAt);
  const [state, formAction, pending] = useActionState(action, initialState);

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.ok && state.data) onSaved(state.data.updatedAt);
  }

  const conflict = !state.ok && Boolean(state.fieldErrors?._conflict);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {field.label}
        {field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      <form action={formAction}>
        <FieldValueInput field={field} value={value} pending={pending} />
      </form>

      {field.description && <p className="text-xs text-zinc-400 dark:text-zinc-500">{field.description}</p>}

      {conflict && (
        <p role="alert" className="text-xs text-amber-600 dark:text-amber-400">
          {state.error}{" "}
          <button type="button" onClick={() => window.location.reload()} className="underline">
            Recarregar
          </button>
        </p>
      )}
      {!state.ok && !conflict && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </div>
  );
}

function FieldValueInput({ field, value, pending }: { field: FieldDefinition; value: unknown; pending: boolean }) {
  const [multiSelected, setMultiSelected] = useState<string[]>(Array.isArray(value) ? (value as string[]) : []);

  if (NOT_YET_EDITABLE.includes(field.type)) {
    return <p className="text-sm text-zinc-400 italic dark:text-zinc-500">Disponível em breve.</p>;
  }

  switch (field.type) {
    case "long_text":
      return (
        <textarea
          name="value"
          defaultValue={typeof value === "string" ? value : ""}
          rows={3}
          disabled={pending}
          onBlur={(e) => e.currentTarget.form?.requestSubmit()}
          className={`${inputClassName} w-full`}
        />
      );

    case "checkbox":
      return (
        <input
          type="checkbox"
          name="value"
          defaultChecked={value === true}
          disabled={pending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="h-4 w-4"
        />
      );

    case "select": {
      const options = field.options ?? [];
      return (
        <select
          name="value"
          defaultValue={typeof value === "string" ? value : ""}
          disabled={pending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={`${inputClassName} w-full`}
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

    case "multi_select": {
      const options = field.options ?? [];
      return (
        <div className="flex flex-wrap gap-2">
          <input type="hidden" name="value" value={JSON.stringify(multiSelected)} />
          {options.map((option) => {
            const checked = multiSelected.includes(option.id);
            return (
              <label
                key={option.id}
                className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs ${
                  checked
                    ? "border-black/20 bg-black/[.06] dark:border-white/20 dark:bg-white/[.1]"
                    : "border-black/[.12] text-zinc-500 dark:border-white/[.16] dark:text-zinc-400"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={checked}
                  disabled={pending}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...multiSelected, option.id]
                      : multiSelected.filter((id) => id !== option.id);
                    setMultiSelected(next);
                    requestAnimationFrame(() => e.currentTarget.form?.requestSubmit());
                  }}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      );
    }

    case "date":
      return (
        <input
          type="date"
          name="value"
          defaultValue={typeof value === "string" ? value : ""}
          disabled={pending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={inputClassName}
        />
      );

    case "datetime":
      return (
        <input
          type="datetime-local"
          name="value"
          defaultValue={typeof value === "string" ? value.slice(0, 16) : ""}
          disabled={pending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={inputClassName}
        />
      );

    case "number":
    case "percent":
    case "rating":
    case "duration":
      return (
        <input
          type="number"
          name="value"
          defaultValue={typeof value === "number" ? value : ""}
          min={field.min}
          max={field.max}
          disabled={pending}
          onBlur={(e) => e.currentTarget.form?.requestSubmit()}
          className={inputClassName}
        />
      );

    case "money":
      return (
        <div className="flex flex-col gap-0.5">
          <input
            type="number"
            name="value"
            defaultValue={typeof value === "number" ? value : ""}
            disabled={pending}
            onBlur={(e) => e.currentTarget.form?.requestSubmit()}
            className={inputClassName}
          />
          <span className="text-xs text-zinc-400 dark:text-zinc-500">Em centavos ({field.currency ?? "BRL"})</span>
        </div>
      );

    case "url":
      return (
        <input
          type="url"
          name="value"
          defaultValue={typeof value === "string" ? value : ""}
          disabled={pending}
          onBlur={(e) => e.currentTarget.form?.requestSubmit()}
          className={`${inputClassName} w-full`}
        />
      );

    case "email":
      return (
        <input
          type="email"
          name="value"
          defaultValue={typeof value === "string" ? value : ""}
          disabled={pending}
          onBlur={(e) => e.currentTarget.form?.requestSubmit()}
          className={`${inputClassName} w-full`}
        />
      );

    case "phone":
      return (
        <input
          type="tel"
          name="value"
          defaultValue={typeof value === "string" ? value : ""}
          disabled={pending}
          onBlur={(e) => e.currentTarget.form?.requestSubmit()}
          className={inputClassName}
        />
      );

    default:
      return (
        <input
          type="text"
          name="value"
          defaultValue={typeof value === "string" ? value : ""}
          disabled={pending}
          onBlur={(e) => e.currentTarget.form?.requestSubmit()}
          className={`${inputClassName} w-full`}
        />
      );
  }
}
