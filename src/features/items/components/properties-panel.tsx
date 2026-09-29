"use client";

import type { ReactNode } from "react";
import { FieldInput } from "@/components/fields/field-input";
import type { FieldDefinition } from "@/features/types/schemas";

export function PropertiesPanel({
  leading,
  itemId,
  typeSlug,
  fields,
  properties,
  updatedAt,
  onSaved,
}: {
  /** Controle próprio do módulo que entra como primeira célula da grade (ex.: tipo de lista). */
  leading?: ReactNode;
  itemId: string;
  typeSlug?: string;
  fields: FieldDefinition[];
  properties: Record<string, unknown>;
  updatedAt: string;
  onSaved: (updatedAt: string) => void;
}) {
  if (fields.length === 0 && !leading) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {leading}
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
            optionsHref={typeSlug ? `/configuracoes/tipos/${typeSlug}` : undefined}
          />
        ))}
    </div>
  );
}
