"use client";

import type { ReactNode } from "react";
import { FieldInput, isFieldEditableOnItem } from "@/components/fields/field-input";
import type { FieldDefinition } from "@/features/types/schemas";

/**
 * Explicação dos campos que vêm dos pacotes e confundiam na tela (o tipo
 * guardado no banco não tem descrição). A descrição do próprio campo, se
 * houver, continua valendo.
 */
const FIELD_HINTS: Record<string, string> = {
  "lista.recurring": "Só uma marca pra lista que você reusa (ex.: compras do mês). Pra começar de novo, use “Nova cópia desmarcada”.",
};

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
  // Campo sem editor ainda (contato, relação, arquivo) não aparece — só confundia com "Disponível em breve".
  const shown = fields
    .filter((field) => !field.hidden && isFieldEditableOnItem(field.type))
    .map((field) => (field.description || !typeSlug ? field : { ...field, description: FIELD_HINTS[`${typeSlug}.${field.key}`] }));
  if (shown.length === 0 && !leading) return null;

  return (
    <div className="grid grid-cols-1 gap-4 rounded-2xl border border-black/[.06] bg-surface p-4 shadow-sm sm:grid-cols-2 dark:border-white/[.06]">
      {leading}
      {shown.map((field) => (
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
