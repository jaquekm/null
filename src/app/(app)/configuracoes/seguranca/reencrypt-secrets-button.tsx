"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { triggerReencryptSecrets } from "./actions";

/** Botão "Recriptografar segredos" (7.7) — rodar depois de trocar `ENCRYPTION_KEY` e mover a antiga pra `ENCRYPTION_KEY_PREVIOUS` no ambiente (`docs/rotacao-segredos.md`). */
export function ReencryptSecretsButton() {
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  function handleClick() {
    setPending(true);
    startTransition(async () => {
      const result = await triggerReencryptSecrets();
      setPending(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Recriptografando em segundo plano — confira em Configurações → Jobs.");
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Rotação de chaves</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Depois de trocar <code>ENCRYPTION_KEY</code> (veja <code>docs/rotacao-segredos.md</code>), rode isto pra
          reescrever as conexões do Google com a chave nova.
        </p>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="self-start rounded-full border border-black/[.12] px-4 py-2 text-sm disabled:opacity-60 dark:border-white/[.16]"
      >
        {pending ? "Iniciando..." : "Recriptografar segredos"}
      </button>
    </section>
  );
}
