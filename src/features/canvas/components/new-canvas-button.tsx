"use client";

import { Frame } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { createCanvasItem } from "../actions";

/**
 * "Novo canvas" (5.5) — ponto de entrada explícito, ao lado do "+ Novo" do
 * espaço. Existe separado do fluxo genérico de criar item porque, pro dono
 * que passou pelo onboarding antes desta fase, o tipo de sistema "Canvas"
 * ainda não existe (mesma lacuna de retroatividade já documentada pros jobs
 * agendados no onboarding financeiro, 4.7/4.8/4.11) — `createCanvasItem`
 * garante o tipo (`ensureCanvasType`) antes de criar o item. Depois da
 * primeira vez, o tipo passa a aparecer no `<select>` do "+ Novo" também.
 */
export function NewCanvasButton({ spaceId }: { spaceId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await createCanvasItem({ title: "Canvas sem título", spaceId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/itens/${result.data.itemId}`);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-2 text-sm text-zinc-700 disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-200"
    >
      <Frame className="h-4 w-4" />
      {pending ? "Criando..." : "Canvas"}
    </button>
  );
}
