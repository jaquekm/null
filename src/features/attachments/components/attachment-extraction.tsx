"use client";

import { ChevronDown, ChevronUp, Copy, FileText, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createNoteFromDocument, getExtractedText, requestExtraction, summarizeDocument, type ExtractedTextDetail } from "../actions";

const buttonClassName =
  "flex items-center gap-1.5 rounded-lg border border-black/[.12] px-2.5 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]";

const STATUS_LABELS: Record<string, string> = {
  none: "",
  queued: "Extraindo texto…",
  processing: "Extraindo texto…",
  skipped: "OCR automático desligado — extração pendente",
  failed: "Falha ao extrair o texto",
  done: "",
};

/** "Aba Texto extraído" (2.9), num anexo elegível pra extração (PDF, imagem, DOCX, TXT/MD/CSV). */
export function AttachmentExtraction({
  attachmentId,
  itemId,
  fileName,
  extractionStatus,
}: {
  attachmentId: string;
  itemId: string;
  fileName?: string;
  extractionStatus: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ExtractedTextDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (detail) return;
    setLoading(true);
    const result = await getExtractedText(attachmentId);
    setDetail(result);
    setLoading(false);
  }

  function handleExtractAgain() {
    startTransition(async () => {
      const result = await requestExtraction(attachmentId, itemId);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Extraindo texto novamente.");
        setDetail(null);
        router.refresh();
      }
    });
  }

  function handleCreateNote() {
    startTransition(async () => {
      const result = await createNoteFromDocument(attachmentId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Nota criada.", { action: { label: "Abrir", onClick: () => router.push(`/itens/${result.data.id}`) } });
    });
  }

  function handleSummarize() {
    startTransition(async () => {
      const result = await summarizeDocument(attachmentId);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Resumo adicionado ao item.");
        router.refresh();
      }
    });
  }

  async function handleCopy() {
    if (!detail?.text) return;
    await navigator.clipboard.writeText(detail.text);
    toast.success("Texto copiado.");
  }

  const statusLabel = STATUS_LABELS[extractionStatus] ?? "";

  return (
    <div className="flex flex-col gap-2 text-xs">
      <button
        type="button"
        onClick={() => void handleToggle()}
        className="flex min-w-0 items-center gap-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <FileText className="h-3.5 w-3.5 shrink-0" />
        {fileName && <span className="truncate">{fileName} —</span>}
        Texto extraído
        {statusLabel && <span className="text-zinc-400 dark:text-zinc-500">— {statusLabel}</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
      </button>

      {open && (
        <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-2.5 dark:border-white/[.08]">
          {loading && <p className="text-zinc-500 dark:text-zinc-400">Carregando…</p>}

          {!loading && detail?.status === "done" && detail.text && (
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap text-black dark:text-zinc-50">{detail.text}</pre>
          )}

          {!loading && detail && detail.status !== "done" && (
            <p className="text-zinc-500 dark:text-zinc-400">{STATUS_LABELS[detail.status] ?? detail.status}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {detail?.status === "done" && detail.text && (
              <button type="button" onClick={() => void handleCopy()} className={buttonClassName}>
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </button>
            )}
            <button type="button" disabled={pending} onClick={handleExtractAgain} className={buttonClassName}>
              <RefreshCw className="h-3.5 w-3.5" />
              Extrair novamente
            </button>
            {detail?.status === "done" && detail.text && (
              <>
                <button type="button" disabled={pending} onClick={handleCreateNote} className={buttonClassName}>
                  Criar nota a partir do documento
                </button>
                <button type="button" disabled={pending} onClick={handleSummarize} className={buttonClassName}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Resumir documento
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
