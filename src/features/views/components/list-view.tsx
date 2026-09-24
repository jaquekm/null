import Link from "next/link";
import { TagBadge } from "@/components/shared/tag-badge";
import type { FieldDefinition } from "@/features/types/schemas";
import type { ViewItemRow } from "../queries";
import { formatPropertyValue } from "../lib/format-property-value";

/** Lista (1.15): título, ícone do tipo, tags, até 3 propriedades escolhidas, data. */
export function ListView({
  rows,
  fields,
  visibleFields,
  typeIcon,
}: {
  rows: ViewItemRow[];
  fields: FieldDefinition[];
  visibleFields?: string[];
  typeIcon?: string | null;
}) {
  const shownFields = pickShownFields(fields, visibleFields);

  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhum item aqui ainda.</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/itens/${row.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            <div className="flex min-w-0 items-center gap-2">
              {typeIcon && <span className="shrink-0">{typeIcon}</span>}
              <span className="truncate text-black dark:text-zinc-50">{row.title || "Sem título"}</span>
              {row.tags.map((tag) => (
                <TagBadge key={tag.id} tag={tag} size="sm" />
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
              {shownFields.map((field) => (
                <span key={field.key}>{formatPropertyValue(row.properties[field.key], field)}</span>
              ))}
              <span>{new Date(row.updatedAt).toLocaleDateString("pt-BR")}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function pickShownFields(fields: FieldDefinition[], visibleFields?: string[]): FieldDefinition[] {
  const keys = visibleFields && visibleFields.length > 0 ? visibleFields : fields.filter((f) => !f.hidden).map((f) => f.key);
  return keys
    .slice(0, 3)
    .map((key) => fields.find((f) => f.key === key))
    .filter((f): f is FieldDefinition => Boolean(f));
}
