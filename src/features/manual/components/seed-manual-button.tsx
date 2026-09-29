"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { seedManual } from "../actions";

export function SeedManualButton({ hasItems }: { hasItems: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await seedManual();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(hasItems ? "Manual atualizado." : "Manual gerado no espaço JKode.");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="bg-brand text-brand-fg self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
    >
      {pending ? "Gerando..." : hasItems ? "Atualizar manual" : "Gerar manual"}
    </button>
  );
}
