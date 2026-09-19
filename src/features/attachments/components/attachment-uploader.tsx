"use client";

import { Paperclip } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { requestTranscription } from "@/features/media/actions";
import { readMediaDuration } from "../lib/read-media-duration";
import { uploadAttachment } from "../lib/upload-file";
import type { AttachmentRow } from "../queries";

export function AttachmentUploader({
  itemId,
  onUploaded,
}: {
  itemId: string;
  onUploaded: (attachment: AttachmentRow) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcribePrompt, setTranscribePrompt] = useState<{ attachmentId: string; fileName: string } | null>(null);
  const [requestingTranscription, startRequestingTranscription] = useTransition();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    for (const file of Array.from(files)) {
      setProgress(0);
      const isMedia = file.type.startsWith("audio/") || file.type.startsWith("video/");
      const durationSeconds = isMedia ? await readMediaDuration(file) : null;
      const result = await uploadAttachment(itemId, file, setProgress, durationSeconds ?? undefined);
      setProgress(null);
      if (!result.ok) {
        setError(result.error);
        continue;
      }
      if (result.data) {
        onUploaded(result.data.attachment);
        // 2.5, ponto de entrada 3: "enviar arquivo de áudio/vídeo existente
        // em qualquer item → pergunta 'Transcrever?'". Anexo reaproveitado
        // (duplicata) já tem transcrição associada se algum dia teve —
        // evita reoferecer.
        if (isMedia && !result.data.reused) {
          setTranscribePrompt({ attachmentId: result.data.attachment.id, fileName: result.data.attachment.fileName });
        }
      }
    }
  }

  function handleTranscribe() {
    if (!transcribePrompt) return;
    const { attachmentId } = transcribePrompt;
    setTranscribePrompt(null);
    startRequestingTranscription(async () => {
      await requestTranscription(itemId, attachmentId);
    });
  }

  return (
    <div className="flex flex-col gap-2">
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3 text-sm transition-colors ${
        dragging
          ? "border-black/40 bg-black/[.03] dark:border-white/40 dark:bg-white/[.05]"
          : "border-black/[.16] dark:border-white/[.2]"
      }`}
    >
      <span className="text-zinc-500 dark:text-zinc-400">Arraste arquivos aqui ou</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Paperclip className="h-4 w-4" />
        Anexar
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {progress !== null && <span className="text-xs text-zinc-400 dark:text-zinc-500">{Math.round(progress * 100)}%</span>}
      {error && (
        <p role="alert" className="w-full text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>

      {transcribePrompt && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
          <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-200">
            Transcrever &quot;{transcribePrompt.fileName}&quot;?
          </span>
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              disabled={requestingTranscription}
              onClick={handleTranscribe}
              className="text-sm text-black underline disabled:opacity-60 dark:text-zinc-50"
            >
              Transcrever
            </button>
            <button
              type="button"
              onClick={() => setTranscribePrompt(null)}
              className="text-sm text-zinc-500 underline dark:text-zinc-400"
            >
              Agora não
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
