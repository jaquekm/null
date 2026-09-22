"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SidebarSpace } from "@/features/spaces/queries";
import { installPackAction } from "../actions";
import type { InstallPackTypeOverride } from "../lib/install";
import type { Pack } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

interface Props {
  file: string;
  pack: Pack;
  spaces: SidebarSpace[];
  missingModules: string[];
  defaultSpaceId?: string | null;
  onClose: () => void;
}

/** Diálogo de instalação (5.2, passo 2): escolher espaço, opcionalmente instalar com exemplos e renomear tipos/campos. */
export function InstallPackDialog({ file, pack, spaces, missingModules, defaultSpaceId, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState(defaultSpaceId ?? "");
  const [withSamples, setWithSamples] = useState(pack.sampleItems.length > 0);
  const [customize, setCustomize] = useState(false);
  const [typeOverrides, setTypeOverrides] = useState<Record<string, InstallPackTypeOverride>>({});

  function updateType(ref: string, patch: Partial<Pick<InstallPackTypeOverride, "name" | "plural" | "icon">>) {
    setTypeOverrides((prev) => ({ ...prev, [ref]: { ...prev[ref], ...patch } }));
  }

  function updateFieldLabel(typeRef: string, fieldKey: string, label: string) {
    setTypeOverrides((prev) => ({
      ...prev,
      [typeRef]: {
        ...prev[typeRef],
        fields: { ...prev[typeRef]?.fields, [fieldKey]: { label } },
      },
    }));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await installPackAction({
        file,
        spaceId: spaceId || null,
        withSamples,
        typeOverrides: customize ? typeOverrides : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const blocked = missingModules.length > 0;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.08] dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Instalar &quot;{pack.name}&quot;</h2>

        {blocked && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Ative primeiro em Configurações: {missingModules.join(", ")}.
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-200">
          Espaço
          <select value={spaceId} onChange={(event) => setSpaceId(event.target.value)} className={inputClassName}>
            <option value="">Todos os espaços</option>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.icon ? `${space.icon} ` : ""}
                {space.name}
              </option>
            ))}
          </select>
        </label>

        {pack.sampleItems.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" checked={withSamples} onChange={(event) => setWithSamples(event.target.checked)} />
            Instalar com exemplos ({pack.sampleItems.length})
          </label>
        )}

        <button type="button" onClick={() => setCustomize((value) => !value)} className="self-start text-sm text-zinc-500 underline dark:text-zinc-400">
          {customize ? "Ocultar personalização" : "Renomear tipos e campos antes de instalar"}
        </button>

        {customize && (
          <div className="flex flex-col gap-3">
            {pack.types.map((type) => (
              <fieldset key={type.ref} className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
                <legend className="px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{type.name}</legend>
                <div className="flex gap-2">
                  <input
                    placeholder="Nome"
                    defaultValue={type.name}
                    onChange={(event) => updateType(type.ref, { name: event.target.value })}
                    className={`${inputClassName} min-w-0 flex-1`}
                  />
                  <input
                    placeholder="🙂"
                    defaultValue={type.icon ?? ""}
                    maxLength={4}
                    onChange={(event) => updateType(type.ref, { icon: event.target.value })}
                    className={`${inputClassName} w-16 text-center`}
                  />
                </div>
                {type.fields.length > 0 && (
                  <div className="flex flex-col gap-1.5 pl-1">
                    {type.fields.map((field) => (
                      <input
                        key={field.key}
                        defaultValue={field.label}
                        onChange={(event) => updateFieldLabel(type.ref, field.key, event.target.value)}
                        className={`${inputClassName} py-1 text-xs`}
                      />
                    ))}
                  </div>
                )}
              </fieldset>
            ))}
          </div>
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
            onClick={handleSubmit}
            disabled={pending || blocked}
            className="bg-foreground text-background rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Instalando..." : "Instalar"}
          </button>
        </div>
      </div>
    </div>
  );
}
