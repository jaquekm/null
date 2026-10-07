"use client";

import { Check, Share2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createShareLink } from "../actions";
import { SHARE_VALIDITY_LABELS, type ShareValidityOption } from "../schemas";
import { ShareQrCode } from "./share-qr-code";

const inputClassName =
  "w-full rounded-lg border border-black/[.08] bg-surface-muted px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-white/[.08]";
const chipClassName =
  "rounded-full border border-black/[.12] px-3 py-1.5 text-sm text-zinc-600 hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]";
const VALIDITIES: ShareValidityOption[] = ["7d", "30d", "90d", "none"];

export function spaceShareMessage(spaceName: string, subcategory: string | null, url: string): string {
  const what = subcategory ? `“${subcategory}” (${spaceName})` : `“${spaceName}”`;
  return `Estou compartilhando ${what} com você: dá pra ver tudo o que está lá, sempre atualizado, sem precisar criar conta. ${url}`;
}

/**
 * "Compartilhar" na página do espaço (9.7): o espaço inteiro ou só uma
 * subcategoria (ex.: "família"), só leitura, com validade e senha
 * opcionais. Depois de criar: copiar, WhatsApp, e-mail e QR code.
 */
export function ShareSpaceButton({
  spaceId,
  spaceName,
  subcategories,
  initialTagId = null,
}: {
  spaceId: string;
  spaceName: string;
  subcategories: { id: string; name: string }[];
  initialTagId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [tagId, setTagId] = useState<string>(initialTagId ?? "");
  const [validity, setValidity] = useState<ShareValidityOption>("90d");
  const [password, setPassword] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [personName, setPersonName] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const subcategory = subcategories.find((sub) => sub.id === tagId)?.name ?? null;
  const message = url ? spaceShareMessage(spaceName, subcategory, url) : "";

  function openDialog() {
    setTagId(initialTagId ?? "");
    setUrl(null);
    setPassword("");
    setCanEdit(false);
    setPersonName("");
    setOpen(true);
  }

  function handleCreate() {
    // Link de edição é um por pessoa: o nome vai nos itens e notas que ela fizer.
    if (canEdit && !personName.trim()) {
      toast.error("Escreva o nome de quem vai usar o link.");
      return;
    }
    startTransition(async () => {
      const result = await createShareLink({
        resourceType: "space",
        resourceId: spaceId,
        tagId: tagId || undefined,
        permission: canEdit ? "edit" : "view",
        label: canEdit ? personName.trim() : undefined,
        validity,
        password,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setUrl(result.data.url);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Share2 className="h-4 w-4" aria-hidden /> Compartilhar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-start sm:p-4 sm:pt-16" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Compartilhar ${spaceName}`}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl border border-black/[.08] bg-surface p-5 shadow-2xl sm:rounded-3xl dark:border-white/[.08]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-black dark:text-zinc-50">Compartilhar “{spaceName}”</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Quem abrir vê a lista e cada item, sem precisar criar conta.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-xl leading-none text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                ×
              </button>
            </div>

            {url ? (
              <div className="flex flex-col gap-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  <Check className="h-4 w-4" aria-hidden /> Link criado{subcategory ? ` — só “${subcategory}”` : ""}.
                </p>
                <input readOnly value={url} aria-label="Link do espaço" onFocus={(e) => e.target.select()} className={inputClassName} />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(message);
                      toast.success("Mensagem com o link copiada.");
                    }}
                    className={chipClassName}
                  >
                    Copiar
                  </button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={chipClassName}>
                    WhatsApp
                  </a>
                  <a href={`mailto:?subject=${encodeURIComponent(subcategory ?? spaceName)}&body=${encodeURIComponent(message)}`} className={chipClassName}>
                    E-mail
                  </a>
                  <ShareQrCode url={url} fileName={`qr-${(subcategory ?? spaceName).toLowerCase().replace(/\s+/g, "-")}`} className={chipClassName} />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Pra parar de compartilhar, revogue em Configurações → Compartilhamentos.</p>
              </div>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  O que compartilhar
                  <select value={tagId} onChange={(e) => setTagId(e.target.value)} className={inputClassName} disabled={pending}>
                    <option value="">O espaço inteiro</option>
                    {subcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        Só a subcategoria “{sub.name}”
                      </option>
                    ))}
                  </select>
                </label>
                <div role="radiogroup" aria-label="O que a pessoa pode fazer" className="flex flex-wrap gap-1.5">
                  {[
                    { edit: false, label: "Só ver" },
                    { edit: true, label: "Pode adicionar e dar nota" },
                  ].map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      role="radio"
                      aria-checked={canEdit === option.edit}
                      disabled={pending}
                      onClick={() => setCanEdit(option.edit)}
                      className={`rounded-full border px-3 py-1.5 text-sm disabled:opacity-60 ${
                        canEdit === option.edit ? "border-transparent bg-brand text-brand-fg" : "border-black/[.12] text-zinc-600 dark:border-white/[.16] dark:text-zinc-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {canEdit && (
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Nome de quem vai usar este link
                    <input value={personName} onChange={(e) => setPersonName(e.target.value)} maxLength={60} placeholder="Ex.: Pedro" className={inputClassName} disabled={pending} />
                    <span className="font-normal">
                      Em cada lista do espaço ele adiciona itens, dá nota e edita só o que adicionou. O nome aparece nos itens e notas dele. Crie um link por pessoa.
                    </span>
                  </label>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Validade
                    <select value={validity} onChange={(e) => setValidity(e.target.value as ShareValidityOption)} className={inputClassName} disabled={pending}>
                      {VALIDITIES.map((value) => (
                        <option key={value} value={value}>
                          {SHARE_VALIDITY_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Senha (opcional)
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputClassName} disabled={pending} />
                  </label>
                </div>
                <button type="button" onClick={handleCreate} disabled={pending} className="rounded-xl bg-brand py-2.5 font-semibold text-brand-fg disabled:opacity-60">
                  {pending ? "Criando link…" : "Criar link"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
