import { Play } from "lucide-react";
import Link from "next/link";
import { formatTimestamp } from "@/features/transcripts/lib/format-timestamp";
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
 * `plainSnippet` (6.6, busca "por significado"): o trecho vem de um chunk de
 * IA, sem marcação `<mark>` de `ts_headline` — renderiza como texto puro em
 * vez de tentar interpretar `parseSnippet`. `seekSeconds` (6.6): quando o
 * trecho mais relevante é de uma transcrição, abre o item já naquele ponto
 * do áudio (`?t=`, lido por `TranscriptViewer`) com um selo "Ouvir a partir
 * de HH:MM:SS".
 */
export function SearchResultRow({
  id,
  title,
  snippet,
  plainSnippet,
  seekSeconds,
  space,
  type,
}: {
  id: string;
  title: string;
  snippet?: string;
  plainSnippet?: boolean;
  seekSeconds?: number | null;
  space?: SpaceOption;
  type?: TypeOption;
}) {
  const href = seekSeconds != null ? `/itens/${id}?t=${Math.floor(seekSeconds)}` : `/itens/${id}`;

  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-lg px-3 py-2.5 transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.06]"
    >
      <span className="truncate text-sm font-medium text-black dark:text-zinc-50">{title || "Sem título"}</span>
      {snippet &&
        (plainSnippet ? (
          <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{snippet}</p>
        ) : (
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
        ))}
      {(space || type || seekSeconds != null) && (
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-400 dark:text-zinc-500">
          {space && (
            <span>
              {space.icon ? `${space.icon} ` : ""}
              {space.name}
            </span>
          )}
          {type && <span>{type.name}</span>}
          {seekSeconds != null && (
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <Play className="h-3 w-3" /> Ouvir a partir de {formatTimestamp(seekSeconds)}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
