"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setOwnerWhatsapp } from "../actions";

/**
 * "Seu WhatsApp" (9.8): número da dona pra lembretes e automações "me avisar
 * no WhatsApp". `channelReady` = o envio por WhatsApp (N8N) está configurado
 * no servidor — sem ele, o número fica salvo mas nada sai ainda.
 */
export function OwnerWhatsappField({ initialPhone, channelReady }: { initialPhone: string | null; channelReady: boolean }) {
  const [value, setValue] = useState(initialPhone ?? "");
  const [saved, setSaved] = useState(initialPhone);
  const [pending, startTransition] = useTransition();

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await setOwnerWhatsapp(value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSaved(result.data.phone);
      setValue(result.data.phone ?? "");
      toast.success(result.data.phone ? "WhatsApp salvo." : "WhatsApp removido.");
    });
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.08]">
      <div>
        <label htmlFor="owner-whatsapp" className="font-medium text-black dark:text-zinc-50">
          Seu WhatsApp
        </label>
        <p className="text-zinc-500 dark:text-zinc-400">Pra receber lembretes e avisos das automações no WhatsApp, além da notificação.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="owner-whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(11) 98888-7777"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-black/20 focus:outline-none dark:border-white/[.16] dark:focus:ring-white/20"
        />
        <button
          type="submit"
          disabled={pending || value.trim() === (saved ?? "")}
          className="bg-brand text-brand-fg rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
      {!channelReady && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          O envio por WhatsApp ainda não está ligado no servidor (fluxo do N8N). O número fica salvo e passa a valer quando ligar.
        </p>
      )}
    </form>
  );
}
