import Link from "next/link";
import { parseSnippet } from "../lib/parse-snippet";

export interface SpaceOption {
  id: string;
  name: string;
  icon: string | null;
}

export interface TypeOption {
  id: string;
  name: string;
}

/**
 * Uma linha de resultado (1.14) — pensada pra ser reaproveitada pela busca
 * da paleta de comandos (1.16, ainda não construída) além da página `/buscar`.
 */
export function SearchResultRow({
  id,
  title,
  snippet,
  space,
  type,
}: {
  id: string;
  title: string;
  snippet?: string;
  space?: SpaceOption;
  type?: TypeOption;
}) {
  return (
    <Link
      href={`/itens/${id}`}
      className="flex flex-col gap-1 rounded-lg px-3 py-2.5 transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.06]"
    >
      <span className="truncate text-sm font-medium text-black dark:text-zinc-50">{title || "Sem título"}</span>
      {snippet && (
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          {parseSnippet(snippet).map((segment, index) =>
            segment.marked ? (
              <mark key={index} className="rounded-sm bg-amber-200/70 px-0.5 dark:bg-amber-500/30">
                {segment.text}
              </mark>
            ) : (
              segment.text
            ),
          )}
        </p>
      )}
      {(space || type) && (
        <div className="flex flex-wrap gap-x-2 text-xs text-zinc-400 dark:text-zinc-500">
          {space && (
            <span>
              {space.icon ? `${space.icon} ` : ""}
              {space.name}
            </span>
          )}
          {type && <span>{type.name}</span>}
        </div>
      )}
    </Link>
  );
}
