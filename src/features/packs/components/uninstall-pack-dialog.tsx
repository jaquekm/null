"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { getPackUninstallPreviewAction, uninstallPackAction } from "../actions";
import type { PackUninstallPreview } from "../lib/uninstall";

/** Diálogo de desinstalação (5.2, passo 7): mostra o que será removido e deixa decidir se arquiva tipos com itens. */
export function UninstallPackDialog({ installedId, onClose }: { installedId: string; onClose: () => void }) {
  const router = useRouter();
  const [preview, setPreview] = useState<PackUninstallPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [archive, setArchive] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPackUninstallPreviewAction(installedId).then((data) => {
      if (!active) return;
      setPreview(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [installedId]);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await uninstallPackAction(installedId, archive);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.08] dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Desinstalar pack</h2>

        {loading && <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>}

        {preview && !loading && (
          <>
            <ul className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-300">
              <li>{preview.automationsCount} automação(ões) será(ão) removida(s)</li>
              <li>{preview.viewsCount} visão(ões) será(ão) removida(s)</li>
              <li>{preview.reminderRulesCount} regra(s) de lembrete será(ão) removida(s)</li>
              <li>{preview.typesWithoutItems.length} tipo(s) sem itens será(ão) excluído(s)</li>
            </ul>

            {preview.typesWithItems.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <p>
                  {preview.typesWithItems.length} tipo(s) têm itens e não podem ser excluídos:{" "}
                  {preview.typesWithItems.map((type) => `${type.name} (${type.itemCount})`).join(", ")}.
                </p>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={archive} onChange={(event) => setArchive(event.target.checked)} />
                  Arquivar esses tipos
                </label>
              </div>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending || loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Desinstalando..." : "Desinstalar"}
          </button>
        </div>
      </div>
    </div>
  );
}
