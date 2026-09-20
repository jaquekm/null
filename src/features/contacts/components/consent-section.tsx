"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setConsent } from "../actions";
import { CONSENT_SOURCE_LABELS, CONSENT_SOURCES } from "../schemas";
import type { ContactDetailRow } from "../queries";

/**
 * "Consentimento: marcar opt-in exige escolher a origem" (3.3) — a tela
 * explica que lembretes pra terceiros só saem com opt-in, e o dono precisa
 * dizer de onde veio o consentimento antes de conseguir ligar qualquer canal.
 */
export function ConsentSection({ contact }: { contact: ContactDetailRow }) {
  const [whatsappOptIn, setWhatsappOptIn] = useState(contact.whatsappOptIn);
  const [emailOptIn, setEmailOptIn] = useState(contact.emailOptIn);
  const [consentSource, setConsentSource] = useState(contact.consentSource ?? "");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await setConsent({
        contactId: contact.id,
        whatsappOptIn,
        emailOptIn,
        consentSource: consentSource ? (consentSource as (typeof CONSENT_SOURCES)[number]) : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Consentimento salvo.");
    });
  }

  const needsSource = (whatsappOptIn || emailOptIn) && !consentSource;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.08]">
      <p className="font-medium text-black dark:text-zinc-50">Consentimento</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Lembretes pra este contato só são enviados nos canais com opt-in ligado, e o WhatsApp Business exige
        confirmar de onde veio o consentimento.
      </p>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={whatsappOptIn} onChange={(e) => setWhatsappOptIn(e.target.checked)} />
        Opt-in WhatsApp
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={emailOptIn} onChange={(e) => setEmailOptIn(e.target.checked)} />
        Opt-in e-mail
      </label>

      {(whatsappOptIn || emailOptIn) && (
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Origem do consentimento
          <select
            value={consentSource}
            onChange={(e) => setConsentSource(e.target.value)}
            className="rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.16]"
          >
            <option value="">Selecione…</option>
            {CONSENT_SOURCES.map((source) => (
              <option key={source} value={source}>
                {CONSENT_SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        </label>
      )}

      {contact.consentAt && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Consentimento registrado em {new Date(contact.consentAt).toLocaleDateString("pt-BR")}.
        </p>
      )}
      {contact.optedOutAt && (
        <p className="text-xs text-red-500">Este contato pediu pra sair em {new Date(contact.optedOutAt).toLocaleDateString("pt-BR")}.</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={pending || needsSource}
        className="self-start rounded-full border border-black/[.12] px-4 py-1.5 text-xs font-medium disabled:opacity-60 dark:border-white/[.16]"
      >
        {pending ? "Salvando..." : "Salvar consentimento"}
      </button>
    </div>
  );
}
