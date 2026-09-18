"use client";

import { Download, File as FileIcon, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteAttachment } from "../actions";
import type { AttachmentRow } from "../queries";
import { AttachmentUploader } from "./attachment-uploader";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentList({ itemId, attachments: initial }: { itemId: string; attachments: AttachmentRow[] }) {
  const [attachments, setAttachments] = useState(initial);
  const [lightbox, setLightbox] = useState<AttachmentRow | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAdd(attachment: AttachmentRow) {
    setAttachments((current) => [...current, attachment]);
  }

  function handleDelete(id: string) {
    if (!window.confirm("Excluir este anexo?")) return;
    startTransition(async () => {
      const result = await deleteAttachment(id, itemId);
      if (result.ok) setAttachments((current) => current.filter((a) => a.id !== id));
    });
  }

  const images = attachments.filter((a) => a.mimeType.startsWith("image/"));
  const others = attachments.filter((a) => !a.mimeType.startsWith("image/"));

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Anexos</span>

      <AttachmentUploader itemId={itemId} onUploaded={handleAdd} />

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((attachment) => (
            <div key={attachment.id} className="group relative">
              <button
                type="button"
                onClick={() => setLightbox(attachment)}
                className="block h-20 w-20 overflow-hidden rounded-lg border border-black/[.08] dark:border-white/[.08]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- URL vem de um redirect pra URL assinada; next/image não lida bem com isso */}
                <img
                  src={`/api/attachments/${attachment.id}/file`}
                  alt={attachment.fileName}
                  className="h-full w-full object-cover"
                />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(attachment.id)}
                disabled={pending}
                aria-label={`Excluir ${attachment.fileName}`}
                className="absolute -top-1 -right-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white group-hover:flex"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <ul className="flex flex-col gap-1">
          {others.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]"
            >
              <AttachmentPreview attachment={attachment} />
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{formatSize(attachment.sizeBytes)}</span>
                <a
                  href={`/api/attachments/${attachment.id}/file?download=1`}
                  aria-label={`Baixar ${attachment.fileName}`}
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(attachment.id)}
                  disabled={pending}
                  aria-label={`Excluir ${attachment.fileName}`}
                  className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {attachments.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum anexo ainda.</p>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- mesma razão do thumbnail acima */}
          <img src={`/api/attachments/${lightbox.id}/file`} alt={lightbox.fileName} className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: AttachmentRow }) {
  const url = `/api/attachments/${attachment.id}/file`;

  if (attachment.mimeType === "application/pdf") {
    return (
      <details className="min-w-0 flex-1">
        <summary className="cursor-pointer truncate text-black dark:text-zinc-50">{attachment.fileName}</summary>
        <embed
          src={url}
          type="application/pdf"
          className="mt-2 h-96 w-full rounded-lg border border-black/[.08] dark:border-white/[.08]"
        />
      </details>
    );
  }

  if (attachment.mimeType.startsWith("audio/")) {
    return (
      <div className="min-w-0 flex-1">
        <p className="truncate text-black dark:text-zinc-50">{attachment.fileName}</p>
        <audio controls src={url} className="mt-1 w-full" />
      </div>
    );
  }

  if (attachment.mimeType.startsWith("video/")) {
    return (
      <div className="min-w-0 flex-1">
        <p className="truncate text-black dark:text-zinc-50">{attachment.fileName}</p>
        <video controls src={url} className="mt-1 max-h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-black dark:text-zinc-50">
      <FileIcon className="h-4 w-4 shrink-0 text-zinc-400" />
      {attachment.fileName}
    </span>
  );
}
