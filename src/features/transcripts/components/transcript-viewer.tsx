"use client";

import { ChevronDown, ChevronUp, Copy, Download, Pencil, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { MeetingSummary } from "@/features/media/schemas";
import type { Segment } from "@/lib/transcription/types";
import { updateSegmentText, updateSpeakerName } from "../actions";
import { exportAsMarkdown, exportAsSrt, exportAsTxt } from "../lib/export-transcript";
import { formatTimestamp } from "../lib/format-timestamp";
import { findMatchingSegments } from "../lib/search-segments";
import { colorForSpeaker, orderSpeakers } from "../lib/speaker-color";
import { summaryToMarkdown } from "../lib/summary-to-markdown";

const buttonClassName =
  "flex items-center gap-1.5 rounded-lg border border-black/[.12] px-2.5 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Destaca (via `<mark>`) a primeira ocorrência do termo buscado dentro do texto do segmento. */
function highlightMatch(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const index = text.toLowerCase().indexOf(trimmed.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-amber-200 dark:bg-amber-700">{text.slice(index, index + trimmed.length)}</mark>
      {text.slice(index + trimmed.length)}
    </>
  );
}

/**
 * Visualizador de transcrição (2.8): player fixo no topo, segmentos com
 * locutor/tempo/texto, clique pula o áudio, busca com navegação, correção
 * de texto, renomear locutor, exportar (.txt/.md/.srt) e copiar resumo.
 * Status "queued"/"processing"/"failed" mostra só uma mensagem — a lista
 * completa só faz sentido com `status === 'completed'`.
 */
export function TranscriptViewer({
  transcriptId,
  attachmentId,
  status,
  error,
  segments: initialSegments,
  speakerNames: initialSpeakerNames,
  summary,
  initialSeek,
}: {
  transcriptId: string;
  attachmentId: string;
  status: string;
  error: string | null;
  segments: Segment[];
  speakerNames: Record<string, string>;
  summary: MeetingSummary | null;
  /** Segundos pra já abrir o player nesse ponto (6.6: "Ouvir a partir de X" no resultado de busca semântica, `?t=`). */
  initialSeek?: number | null;
}) {
  const [segments, setSegments] = useState(initialSegments);
  const [speakerNames, setSpeakerNames] = useState(initialSpeakerNames);
  const [currentTime, setCurrentTime] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [query, setQuery] = useState("");
  const [matchCursor, setMatchCursor] = useState(0);
  const [previousQuery, setPreviousQuery] = useState(query);
  const [renamingSpeaker, setRenamingSpeaker] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [textDraft, setTextDraft] = useState("");

  const audioRef = useRef<HTMLAudioElement>(null);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);

  const orderedSpeakers = useMemo(() => orderSpeakers(segments.map((s) => s.speaker)), [segments]);
  const activeIndex = useMemo(
    () => segments.findIndex((s) => currentTime >= s.start && currentTime < s.end),
    [segments, currentTime],
  );
  const matches = useMemo(() => findMatchingSegments(segments, query), [segments, query]);

  if (query !== previousQuery) {
    setPreviousQuery(query);
    setMatchCursor(0);
  }

  useEffect(() => {
    if (!autoScroll || activeIndex === -1) return;
    segmentRefs.current[activeIndex]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex, autoScroll]);

  if (status !== "completed") {
    return (
      <div className="rounded-lg border border-black/[.08] p-3 text-sm text-zinc-500 dark:border-white/[.08] dark:text-zinc-400">
        {status === "failed"
          ? `Falha na transcrição${error ? `: ${error}` : "."}`
          : "Transcrevendo… costuma levar alguns minutos."}
      </div>
    );
  }

  function seekTo(time: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    void audioRef.current.play();
  }

  function goToMatch(delta: number) {
    if (matches.length === 0) return;
    const next = (matchCursor + delta + matches.length) % matches.length;
    setMatchCursor(next);
    const index = matches[next]!;
    segmentRefs.current[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function startRename(speaker: string) {
    setRenamingSpeaker(speaker);
    setNameDraft(speakerNames[speaker] ?? "");
  }

  async function saveRename(speaker: string) {
    const name = nameDraft.trim();
    setRenamingSpeaker(null);
    if (!name || name === speakerNames[speaker]) return;

    const result = await updateSpeakerName(transcriptId, speaker, name);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSpeakerNames((current) => ({ ...current, [speaker]: name }));
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setTextDraft(segments[index]!.text);
  }

  async function saveEdit(index: number) {
    const text = textDraft.trim();
    setEditingIndex(null);
    if (!text || text === segments[index]!.text) return;

    const result = await updateSegmentText(transcriptId, index, text);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSegments((current) => current.map((segment, i) => (i === index ? { ...segment, text } : segment)));
  }

  function handleExport(format: "txt" | "md" | "srt") {
    const base = `transcricao-${transcriptId.slice(0, 8)}`;
    if (format === "txt") triggerDownload(`${base}.txt`, exportAsTxt(segments), "text/plain");
    if (format === "md") triggerDownload(`${base}.md`, exportAsMarkdown(segments, speakerNames), "text/markdown");
    if (format === "srt") triggerDownload(`${base}.srt`, exportAsSrt(segments, speakerNames), "application/x-subrip");
  }

  async function handleCopySummary() {
    if (!summary) return;
    await navigator.clipboard.writeText(summaryToMarkdown(summary));
    toast.success("Resumo copiado em Markdown.");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-14 z-[5] -mx-1 rounded-lg border border-black/[.08] bg-white/95 p-2 backdrop-blur dark:border-white/[.08] dark:bg-black/95">
        <audio
          ref={audioRef}
          controls
          src={`/api/attachments/${attachmentId}/file`}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            if (initialSeek != null) e.currentTarget.currentTime = initialSeek;
          }}
          className="w-full"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar na transcrição"
            aria-label="Buscar na transcrição"
            className={`${inputClassName} w-full`}
          />
          {query.trim() && (
            <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
              {matches.length > 0 ? `${matchCursor + 1}/${matches.length}` : "0"}
            </span>
          )}
          <button type="button" onClick={() => goToMatch(-1)} disabled={matches.length === 0} aria-label="Ocorrência anterior" className={buttonClassName}>
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => goToMatch(1)} disabled={matches.length === 0} aria-label="Próxima ocorrência" className={buttonClassName}>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          Rolagem automática
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => handleExport("txt")} className={buttonClassName}>
          <Download className="h-3.5 w-3.5" />
          .txt
        </button>
        <button type="button" onClick={() => handleExport("md")} className={buttonClassName}>
          <Download className="h-3.5 w-3.5" />
          .md
        </button>
        <button type="button" onClick={() => handleExport("srt")} className={buttonClassName}>
          <Download className="h-3.5 w-3.5" />
          .srt
        </button>
        {summary && (
          <button type="button" onClick={() => void handleCopySummary()} className={buttonClassName}>
            <Copy className="h-3.5 w-3.5" />
            Copiar resumo em Markdown
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {segments.map((segment, index) => {
          const isActive = index === activeIndex;
          const isMatch = matches.includes(index);
          const displayName = speakerNames[segment.speaker] ?? `Locutor ${segment.speaker}`;

          return (
            <div
              key={index}
              ref={(el) => {
                segmentRefs.current[index] = el;
              }}
              onClick={() => seekTo(segment.start)}
              className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-2.5 transition-colors ${
                isActive
                  ? "border-black/20 bg-black/[.04] dark:border-white/30 dark:bg-white/[.08]"
                  : isMatch
                    ? "border-amber-300 dark:border-amber-800"
                    : "border-transparent"
              }`}
            >
              <div className="flex items-center gap-2 text-xs">
                {renamingSpeaker === segment.speaker ? (
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveRename(segment.speaker);
                      if (e.key === "Escape") setRenamingSpeaker(null);
                    }}
                    onBlur={() => void saveRename(segment.speaker)}
                    aria-label="Nome do locutor"
                    className={inputClassName}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(segment.speaker);
                    }}
                    className={`font-medium hover:underline ${colorForSpeaker(segment.speaker, orderedSpeakers)}`}
                  >
                    {displayName}
                  </button>
                )}
                <span className="font-mono text-zinc-400 dark:text-zinc-500">{formatTimestamp(segment.start)}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(index);
                  }}
                  aria-label="Corrigir texto do segmento"
                  className="ml-auto text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>

              {editingIndex === index ? (
                <textarea
                  autoFocus
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditingIndex(null);
                  }}
                  onBlur={() => void saveEdit(index)}
                  rows={2}
                  className={`${inputClassName} w-full resize-none`}
                />
              ) : (
                <p className="text-sm text-black dark:text-zinc-50">{highlightMatch(segment.text, query)}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
