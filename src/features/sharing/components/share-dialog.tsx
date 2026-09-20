"use client";

import { Share2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { searchContacts } from "@/features/contacts/actions";
import type { ContactRow } from "@/features/contacts/queries";
import { createShareLink } from "../actions";
import {
  SHARE_PERMISSIONS,
  SHARE_PERMISSION_LABELS,
  SHARE_VALIDITY_OPTIONS,
  SHARE_VALIDITY_LABELS,
  type ShareValidityOption,
  type SharePermission,
} from "../schemas";
import { ShareLinksList } from "./share-links-list";
import type { ShareLinkRow } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

/** Diálogo "Compartilhar" (3.11) — criar link + lista de links ativos do item. */
export function ShareDialog({ itemId, links }: { itemId: string; links: ShareLinkRow[] }) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [permission, setPermission] = useState<SharePermission>("view");
  const [validity, setValidity] = useState<ShareValidityOption>("30d");
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [password, setPassword] = useState("");
  const [contactId, setContactId] = useState("");
  const [label, setLabel] = useState("");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      setContacts(await searchContacts({}));
    });
  }, [open]);

  function resetForm() {
    setPermission("view");
    setValidity("30d");
    setIncludeAttachments(false);
    setPassword("");
    setContactId("");
    setLabel("");
    setCreatedUrl(null);
    setFieldErrors({});
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  function handleCreate() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createShareLink({
        resourceId: itemId,
        permission,
        validity,
        includeAttachments,
        password: password || undefined,
        contactId: contactId || undefined,
        label: label || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      setCreatedUrl(result.data.url);
      router.refresh();
    });
  }

  const selectedContact = contacts.find((c) => c.id === contactId);
  const shareText = `Veja: ${createdUrl ?? ""}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]"
      >
        <Share2 className="h-4 w-4" /> Compartilhar
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-black dark:text-zinc-50">Compartilhar</h2>
              <button type="button" onClick={handleClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
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
                  <a
                    href={`https://wa.me/${selectedContact?.phoneE164?.replace(/\D/g, "") ?? ""}?text=${encodeURIComponent(shareText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`mailto:${selectedContact?.email ?? ""}?body=${encodeURIComponent(shareText)}`}
                    className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]"
                  >
                    E-mail
                  </a>
                </div>
                <button type="button" onClick={resetForm} className="self-start text-sm text-zinc-500 hover:underline dark:text-zinc-400">
                  Criar outro link
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelClassName}>
                    Permissão
                    <select value={permission} onChange={(e) => setPermission(e.target.value as SharePermission)} className={inputClassName} disabled={pending}>
                      {SHARE_PERMISSIONS.map((p) => (
                        <option key={p} value={p}>
                          {SHARE_PERMISSION_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </label>
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
                  <label className={labelClassName}>
                    Senha (opcional)
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClassName}
                      disabled={pending}
                    />
                    {fieldErrors.password && <span className="text-red-500">{fieldErrors.password[0]}</span>}
                  </label>
                  <label className={labelClassName}>
                    Contato (opcional)
                    <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputClassName} disabled={pending}>
                      <option value="">Nenhum</option>
                      {contacts.map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClassName}>
                    Rótulo (opcional)
                    <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClassName} disabled={pending} />
                  </label>
                </div>

                {validity === "none" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">Esse link nunca expira — cuidado a quem você envia.</p>
                )}

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={includeAttachments} onChange={(e) => setIncludeAttachments(e.target.checked)} disabled={pending} />
                  Incluir anexos
                </label>

                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={pending}
                  className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {pending ? "Criando..." : "Criar link"}
                </button>
              </div>
            )}

            {links.length > 0 && (
              <div className="mt-4 border-t border-black/[.08] pt-4 dark:border-white/[.08]">
                <ShareLinksList links={links} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
