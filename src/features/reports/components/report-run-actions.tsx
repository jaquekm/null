"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { searchContacts } from "@/features/contacts/actions";
import type { ContactRow } from "@/features/contacts/queries";
import { getReportShareUrl, resendReportRun } from "../actions";
import { reportChannels, type ReportChannel } from "../schemas";

const CHANNEL_LABELS: Record<ReportChannel, string> = { push: "Push (pra mim)", email: "E-mail (pra mim)", whatsapp: "WhatsApp (contatos)" };

/** Botões da tela do relatório (6.4): Baixar PDF, Compartilhar link, Enviar. */
export function ReportRunActions({ reportRunId, pdfAttachmentId }: { reportRunId: string; pdfAttachmentId: string | null }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [channels, setChannels] = useState<ReportChannel[]>(["push"]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!sendOpen) return;
    startTransition(async () => {
      setContacts(await searchContacts({}));
    });
  }, [sendOpen]);

  function handleShare() {
    startTransition(async () => {
      const result = await getReportShareUrl(reportRunId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setShareUrl(result.data.url);
    });
  }

  function toggleChannel(channel: ReportChannel, checked: boolean) {
    setChannels((prev) => (checked ? [...prev, channel] : prev.filter((c) => c !== channel)));
  }

  function toggleContact(id: string, checked: boolean) {
    setContactIds((prev) => (checked ? [...prev, id] : prev.filter((c) => c !== id)));
  }

  function handleSend() {
    if (channels.length === 0) {
      toast.error("Escolha ao menos um canal.");
      return;
    }
    startTransition(async () => {
      const result = await resendReportRun(reportRunId, { channels, contactIds });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Enviado.");
      setSendOpen(false);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pdfAttachmentId && (
        <a href={`/api/attachments/${pdfAttachmentId}/file?download=1`} className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]">
          Baixar PDF
        </a>
      )}

      {shareUrl ? (
        <div className="flex items-center gap-2">
          <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]" />
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl);
              toast.success("Link copiado.");
            }}
            className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]"
          >
            Copiar
          </button>
        </div>
      ) : (
        <button type="button" onClick={handleShare} disabled={pending} className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]">
          Compartilhar
        </button>
      )}

      <button type="button" onClick={() => setSendOpen(true)} className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]">
        Enviar
      </button>

      {sendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSendOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-black dark:text-zinc-50">Enviar relatório</h2>
              <button type="button" onClick={() => setSendOpen(false)} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                ×
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                {reportChannels.map((channel) => (
                  <label key={channel} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={channels.includes(channel)} onChange={(e) => toggleChannel(channel, e.target.checked)} disabled={pending} />
                    {CHANNEL_LABELS[channel]}
                  </label>
                ))}
              </div>

              {channels.includes("whatsapp") && (
                <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-black/[.08] p-2 dark:border-white/[.08]">
                  {contacts.length === 0 ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Nenhum contato encontrado.</p>
                  ) : (
                    contacts.map((contact) => (
                      <label key={contact.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={contactIds.includes(contact.id)} onChange={(e) => toggleContact(contact.id, e.target.checked)} disabled={pending} />
                        {contact.name}
                      </label>
                    ))
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleSend}
                disabled={pending}
                className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
              >
                {pending ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
