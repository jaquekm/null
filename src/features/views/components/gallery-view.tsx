import { ImageIcon } from "lucide-react";
import Link from "next/link";
import type { FieldDefinition } from "@/features/types/schemas";
import { formatPropertyValue } from "../lib/format-property-value";
import { resolveCoverSrc } from "../lib/resolve-cover";
import type { ViewItemRow } from "../queries";

/** Galeria (5.4): cards com capa (`cover_path` ou primeira imagem do conteúdo), título e campos escolhidos. */
export function GalleryView({ rows, fields, visibleFields }: { rows: ViewItemRow[]; fields: FieldDefinition[]; visibleFields?: string[] }) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhum item aqui ainda.</p>;
  }

  const shownFields = pickShownFields(fields, visibleFields);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {rows.map((row) => {
        const cover = resolveCoverSrc(row.coverPath, row.content ?? null);
        return (
          <Link
            key={row.id}
            href={`/itens/${row.id}`}
            className="flex flex-col overflow-hidden rounded-lg border border-black/[.08] transition-colors hover:bg-black/[.02] dark:border-white/[.08] dark:hover:bg-white/[.04]"
          >
            <div className="flex aspect-square items-center justify-center overflow-hidden bg-black/[.03] dark:bg-white/[.05]">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- capa vem de anexo próprio (URL estável), não faz sentido otimizar via next/image aqui
                <img src={cover} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
              )}
            </div>
            <div className="flex flex-col gap-0.5 p-2">
              <p className="truncate text-sm text-black dark:text-zinc-50">{row.title || "Sem título"}</p>
              {shownFields.map((field) => (
                <span key={field.key} className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {formatPropertyValue(row.properties[field.key], field)}
                </span>
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function pickShownFields(fields: FieldDefinition[], visibleFields?: string[]): FieldDefinition[] {
  const keys = visibleFields && visibleFields.length > 0 ? visibleFields : fields.filter((field) => field.showInCard).map((field) => field.key);
  return keys
    .slice(0, 3)
    .map((key) => fields.find((field) => field.key === key))
    .filter((field): field is FieldDefinition => Boolean(field));
}
