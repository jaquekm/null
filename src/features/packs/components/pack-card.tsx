"use client";

import { useState } from "react";
import type { SidebarSpace } from "@/features/spaces/queries";
import type { InstalledPackRow } from "../queries";
import type { Pack } from "../schemas";
import { InstallPackDialog } from "./install-pack-dialog";
import { UninstallPackDialog } from "./uninstall-pack-dialog";

interface Props {
  file: string;
  pack: Pack;
  spaces: SidebarSpace[];
  installed: InstalledPackRow[];
  missingModules: string[];
}

/** Card da galeria de packs (5.2, `/configuracoes/metodos`): descrição, prévia do que será criado, instalar/atualizar/desinstalar. */
export function PackCard({ file, pack, spaces, installed, missingModules }: Props) {
  const [installDialog, setInstallDialog] = useState<{ spaceId: string | null } | null>(null);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-black/[.08] p-4 dark:border-white/[.08]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-black dark:text-zinc-50">
            <span>{pack.icon || "📦"}</span>
            {pack.name}
            <span className="text-xs font-normal text-zinc-400">v{pack.version}</span>
          </h2>
          {pack.description && <p className="text-sm text-zinc-500 dark:text-zinc-400">{pack.description}</p>}
        </div>
        <button
          type="button"
          onClick={() => setInstallDialog({ spaceId: null })}
          className="bg-foreground text-background shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium"
        >
          Instalar
        </button>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {pack.types.length} tipo(s) · {pack.views.length} visão(ões) · {pack.automations.length} automação(ões)
        {pack.reminderRules.length > 0 && ` · ${pack.reminderRules.length} lembrete(s)`}
        {pack.sampleItems.length > 0 && ` · ${pack.sampleItems.length} exemplo(s)`}
      </p>

      {missingModules.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300">Requer: {missingModules.join(", ")} (desligado nas configurações)</p>
      )}

      {installed.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-black/[.06] pt-2 text-sm dark:border-white/[.06]">
          {installed.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2">
              <span className="text-zinc-600 dark:text-zinc-300">
                {row.spaceName ?? "Todos os espaços"} · v{row.version}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInstallDialog({ spaceId: row.spaceId })}
                  className="text-xs text-zinc-500 underline dark:text-zinc-400"
                >
                  Atualizar
                </button>
                <button type="button" onClick={() => setUninstallingId(row.id)} className="text-xs text-red-600 underline dark:text-red-400">
                  Desinstalar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {installDialog && (
        <InstallPackDialog
          file={file}
          pack={pack}
          spaces={spaces}
          missingModules={missingModules}
          defaultSpaceId={installDialog.spaceId}
          onClose={() => setInstallDialog(null)}
        />
      )}
      {uninstallingId && <UninstallPackDialog installedId={uninstallingId} onClose={() => setUninstallingId(null)} />}
    </div>
  );
}
