"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { revokeShareLink } from "../actions";
import { SHARE_PERMISSION_LABELS, type SharePermission } from "../schemas";
import type { ShareLinkRow, ShareLinkWithItemRow } from "../queries";

function isActive(link: ShareLinkRow): boolean {
  if (link.revokedAt) return false;
  if (link.expiresAt && new Date(link.expiresAt) <= new Date()) return false;
  return true;
}

/** Lista de links de compartilhamento (3.11) — usada no item e em `/configuracoes/compartilhamentos`. */
export function ShareLinksList({ links }: { links: (ShareLinkRow | ShareLinkWithItemRow)[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleRevoke(id: string) {
    startTransition(async () => {
      const result = await revokeShareLink(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Link revogado.");
      router.refresh();
    });
  }

  return (
    <ul className="flex flex-col gap-2">
      {links.map((link) => {
        const active = isActive(link);
        return (
          <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[.08] p-2 text-sm dark:border-white/[.08]">
            <div className="flex flex-col">
              <span className="font-medium text-black dark:text-zinc-50">
                {"itemTitle" in link && link.itemTitle ? link.itemTitle : link.label || SHARE_PERMISSION_LABELS[link.permission as SharePermission]}
                {!active && <span className="ml-2 text-xs text-red-500">{link.revokedAt ? "Revogado" : "Expirado"}</span>}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {SHARE_PERMISSION_LABELS[link.permission as SharePermission]} · {link.viewCount} visualizações
                {link.lastViewedAt && ` · último acesso em ${new Date(link.lastViewedAt).toLocaleString("pt-BR")}`}
              </span>
            </div>
            {active && (
              <button
                type="button"
                onClick={() => handleRevoke(link.id)}
                disabled={pending}
                className="text-xs text-red-500 hover:underline disabled:opacity-60"
              >
                Revogar
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
