"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { SidebarSpace } from "@/features/spaces/queries";
import { completeFinanceOnboarding, setFinanceAiEnabled } from "../actions";
import type { AccountRow, CategoryRow, PixKeyRow } from "../queries";
import { AccountSection } from "./account-section";
import { CategorySection } from "./category-section";
import { PixKeySection } from "./pix-key-section";

/** `/financas/configurar` (4.3) — os 4 passos do onboarding financeiro numa página só. */
export function FinanceOnboarding({
  accounts,
  categories,
  pixKeys,
  spaces,
  initialAiEnabled,
}: {
  accounts: AccountRow[];
  categories: CategoryRow[];
  pixKeys: PixKeyRow[];
  spaces: SidebarSpace[];
  initialAiEnabled: boolean;
}) {
  const [aiEnabled, setAiEnabled] = useState(initialAiEnabled);
  const [pending, startTransition] = useTransition();
  const [finishing, startFinishTransition] = useTransition();
  const router = useRouter();

  function handleToggleAi(checked: boolean) {
    setAiEnabled(checked);
    startTransition(async () => {
      const result = await setFinanceAiEnabled(checked);
      if (!result.ok) {
        toast.error(result.error);
        setAiEnabled(!checked);
      }
    });
  }

  function handleFinish() {
    startFinishTransition(async () => {
      const result = await completeFinanceOnboarding();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push("/financas");
    });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Configurar Finanças</h1>
        <p className="text-sm text-black/60 dark:text-white/60">Primeiro acesso ao módulo — pode voltar aqui depois em Finanças.</p>
      </div>

      <AccountSection accounts={accounts} spaces={spaces} />
      <CategorySection categories={categories} />
      <PixKeySection pixKeys={pixKeys} spaces={spaces} />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">4. IA</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={aiEnabled} onChange={(e) => handleToggleAi(e.target.checked)} disabled={pending} />
          Enviar dados financeiros para a IA (categorização automática, relatórios)
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Desligado por padrão. {aiEnabled ? "Ligado." : "Desligado."}</p>
      </div>

      <button
        type="button"
        onClick={handleFinish}
        disabled={finishing}
        className="bg-foreground text-background self-start rounded-full px-6 py-2 text-sm font-medium disabled:opacity-60"
      >
        {finishing ? "Concluindo..." : "Concluir configuração"}
      </button>
    </div>
  );
}
