"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/money";
import { createShareLink } from "../actions";
import { SHARE_VALIDITY_LABELS, SHARE_VALIDITY_OPTIONS, type ShareResourceType, type ShareValidityOption } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

/**
 * "Cobrar" (4.10) — cria um link `settle` de uma divisão (por participante)
 * ou conta a receber, com botão de WhatsApp já usando o texto padrão do
 * enunciado. Mais simples que `ShareDialog` (3.11): sem seletor de
 * permissão (sempre `settle`) nem de contato (já vem do recurso).
 */
export function ChargeLinkDialog({
  resourceType,
  resourceId,
  title,
  amountCents,
  contactName,
  contactPhone,
  hasAttachment,
  showFullSplitOption,
  onClose,
}: {
  resourceType: ShareResourceType;
  resourceId: string;
  title: string;
  amountCents: number;
  contactName: string | null;
  contactPhone: string | null;
  hasAttachment: boolean;
  showFullSplitOption: boolean;
  onClose: () => void;
}) {
  const [validity, setValidity] = useState<ShareValidityOption>("30d");
  const [includeAttachments, setIncludeAttachments] = useState(hasAttachment);
  const [showFullSplit, setShowFullSplit] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createShareLink({
        resourceType,
        resourceId,
        permission: "settle",
        validity,
        includeAttachments,
        showFullSplit,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCreatedUrl(result.data.url);
    });
  }

  const amountLabel = formatBRL(amountCents);
  const message = `Oi ${contactName ?? ""}! Segue sua parte de ${title}: ${amountLabel}. Pix e detalhes: ${createdUrl ?? ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Cobrar{contactName ? ` ${contactName}` : ""}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        {createdUrl ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Link criado:</p>
            <input readOnly value={createdUrl} className={inputClassName} onFocus={(e) => e.target.select()} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(createdUrl);
                  toast.success("Link copiado.");
                }}
                className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]"
              >
                Copiar
              </button>
              {contactPhone && (
                <a
                  href={`https://wa.me/${contactPhone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]"
                >
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {title} · {amountLabel}
            </p>
            <label className={labelClassName}>
              Validade
              <select value={validity} onChange={(e) => setValidity(e.target.value as ShareValidityOption)} className={inputClassName} disabled={pending}>
                {SHARE_VALIDITY_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {SHARE_VALIDITY_LABELS[v]}
                  </option>
                ))}
              </select>
            </label>

            {hasAttachment && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeAttachments} onChange={(e) => setIncludeAttachments(e.target.checked)} disabled={pending} />
                Incluir recibo/anexo
              </label>
            )}

            {showFullSplitOption && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showFullSplit} onChange={(e) => setShowFullSplit(e.target.checked)} disabled={pending} />
                Mostrar a divisão completa (não só a parte dessa pessoa)
              </label>
            )}

            <button
              type="button"
              onClick={handleCreate}
              disabled={pending}
              className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {pending ? "Criando..." : "Criar link de cobrança"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
