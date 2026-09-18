"use client";

import { FieldInput } from "@/components/fields/field-input";
import type { FieldDefinition } from "@/features/types/schemas";

export function PropertiesPanel({
  itemId,
  fields,
  properties,
  updatedAt,
  onSaved,
}: {
  itemId: string;
  fields: FieldDefinition[];
  properties: Record<string, unknown>;
  updatedAt: string;
  onSaved: (updatedAt: string) => void;
}) {
  if (fields.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields
        .filter((field) => !field.hidden)
        .map((field) => (
          <FieldInput
            key={field.key}
            itemId={itemId}
            field={field}
            value={properties[field.key]}
            updatedAt={updatedAt}
            onSaved={onSaved}
          />
        ))}
    </div>
  );
}
