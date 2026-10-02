"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { installBundle } from "../actions";
import { BUNDLES, pendingPacksForBundle, type BundleKey } from "../lib/bundles";

function BundleButton({ bundleKey, done }: { bundleKey: BundleKey; done: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await installBundle(bundleKey);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pronto!");
      router.push(result.data.redirectHref);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="bg-brand text-brand-fg shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60"
    >
      {pending ? "Configurando..." : done ? "Abrir" : "Configurar"}
    </button>
  );
}

/**
 * "Pacotes prontos" (10.15, topo de `/configuracoes/metodos`): "Rotina",
 * "Saúde", "Alimentação" e "Finanças pessoais" juntam, com um toque, os
 * packs que cada área da vida precisa — em vez de instalar um por um.
 */
export function BundlesSection({ installedPackKeys, financeOnboardingCompleted }: { installedPackKeys: string[]; financeOnboardingCompleted: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold text-black dark:text-zinc-50">Pacotes prontos</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Um toque pra montar tudo que uma área da vida costuma precisar.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BUNDLES.map((bundle) => {
          const pending = pendingPacksForBundle(bundle, installedPackKeys);
          const done = pending.length === 0 && (!bundle.completeFinanceOnboarding || financeOnboardingCompleted);
          return (
            <div key={bundle.key} className="flex items-start justify-between gap-3 rounded-xl border border-black/[.08] p-4 dark:border-white/[.08]">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-black dark:text-zinc-50">
                  <span>{bundle.icon}</span>
                  {bundle.name}
                  {done && <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">· configurado</span>}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{bundle.description}</p>
              </div>
              <BundleButton bundleKey={bundle.key} done={done} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
