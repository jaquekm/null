"use client";

import { Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createShareLink } from "../actions";
import { isShareLinkActive } from "../lib/is-share-link-active";
import { shareMessage } from "../lib/share-message";
import type { ShareLinkRow } from "../queries";
import type { SharePermission } from "../schemas";
import { ShareDialog } from "./share-dialog";

const QUICK_PERMISSIONS: { value: SharePermission; label: string; listOnly?: boolean }[] = [
  { value: "view", label: "Só acompanhar" },
  { value: "comment", label: "Acompanhar e comentar" },
  { value: "check", label: "Pode marcar itens", listOnly: true },
];

const chipClassName = "rounded-full border px-3 py-1.5 text-sm disabled:opacity-60";
const chipOn = "border-transparent bg-black text-white dark:bg-white dark:text-black";
const chipOff = "border-black/[.12] text-zinc-600 hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]";

/**
 * Bloco "Compartilhar" no fim da página do item: um toque cria um link
 * (90 dias) e abre o compartilhar do celular; no computador mostra o link
 * com Copiar e WhatsApp. Senha, validade e contato ficam em "Mais opções"
 * (o diálogo completo da 3.11).
 */
export function ShareFooter({ itemId, title, isList, links }: { itemId: string; title: string; isList: boolean; links: ShareLinkRow[] }) {
  const [permission, setPermission] = useState<SharePermission>("view");
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const message = url ? shareMessage(title, url, isList) : "";
  const activeLinks = links.filter((link) => isShareLinkActive(link)).length;

  function handleShare() {
    startTransition(async () => {
      const result = await createShareLink({ resourceId: itemId, permission, validity: "90d" });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setUrl(result.data.url);
      router.refresh();
      if (typeof navigator.share === "function") {
        // Fechar a folha de compartilhar do celular sem escolher nada rejeita a promise — não é erro, o link continua na tela.
        navigator.share({ title: title || "Hub", text: shareMessage(title, result.data.url, isList) }).catch(() => {});
      }
    });
  }

  return (
    <section aria-labelledby={`share-${itemId}`} className="flex flex-col gap-3 rounded-2xl border border-black/[.08] p-4 dark:border-white/[.08]">
      <div>
        <h2 id={`share-${itemId}`} className="flex items-center gap-2 font-semibold">
          <Share2 className="h-4 w-4" aria-hidden /> {isList ? "Compartilhar esta lista" : "Compartilhar"}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Quem receber o link acompanha a versão atual, sem precisar criar conta.</p>
      </div>

      {url ? (
        <div className="flex flex-col gap-2">
          <input
            readOnly
            value={url}
            aria-label="Link de compartilhamento"
            onFocus={(e) => e.target.select()}
            className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm dark:border-white/[.16]"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(message);
                toast.success("Mensagem com o link copiada.");
              }}
              className={`${chipClassName} ${chipOff}`}
            >
              Copiar
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={`${chipClassName} ${chipOff}`}>
              WhatsApp
            </a>
            <a href={`mailto:?subject=${encodeURIComponent(title || "Hub")}&body=${encodeURIComponent(message)}`} className={`${chipClassName} ${chipOff}`}>
              E-mail
            </a>
            <button type="button" onClick={() => setUrl(null)} className="text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400">
              Criar outro link
            </button>
          </div>
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-label="O que a pessoa pode fazer" className="flex flex-wrap gap-1.5">
            {QUICK_PERMISSIONS.filter((option) => isList || !option.listOnly).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={permission === option.value}
                disabled={pending}
                onClick={() => setPermission(option.value)}
                className={`${chipClassName} ${permission === option.value ? chipOn : chipOff}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleShare}
            disabled={pending}
            className="flex items-center justify-center gap-2 rounded-xl bg-black py-2.5 font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            <Share2 className="h-4 w-4" aria-hidden /> {pending ? "Criando link…" : "Compartilhar"}
          </button>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          {activeLinks > 0 ? `${activeLinks} ${activeLinks === 1 ? "link ativo" : "links ativos"} · ` : ""}o link vale por 90 dias
        </span>
        <ShareDialog itemId={itemId} links={links} triggerLabel="Mais opções (senha, validade, ver links)" />
      </div>
    </section>
  );
}
