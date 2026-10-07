"use client";

import { Bell, BellRing } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { searchContacts } from "@/features/contacts/actions";
import type { ContactRow } from "@/features/contacts/queries";
import { createReminderFromPhrase } from "../actions";
import { describeReminderPhrase, parseReminderPhrase } from "../lib/parse-reminder-phrase";
import { ReminderForm } from "./reminder-form";

export const QUICK_REMINDER_SUGGESTIONS = ["hoje 18h", "amanhã 9h", "segunda 9h", "daqui a 1 hora", "todo dia 8h", "toda segunda"];

interface QuickReminderProps {
  /** Do que é o lembrete (título do item ou texto do item da lista). */
  title: string;
  timezone: string;
  itemId?: string | null;
  sourceType?: string;
  sourceId?: string;
  /** "button": botão "Me lembrar" com texto; "icon": só o sininho (linhas de lista). */
  variant?: "button" | "icon";
}

/**
 * "Me lembrar…" (9.4): escreve o quando do jeito que se fala ("amanhã 9h",
 * "toda segunda", "dia 10 de todo mês") e vê na hora o que foi entendido.
 * Canal, contatos e mensagem continuam em "Mais opções" (o formulário
 * completo de sempre).
 */
export function QuickReminder({ title, timezone, itemId, sourceType, sourceId, variant = "button" }: QuickReminderProps) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Relógio lido só quando a frase muda — a prévia sempre bate com o que o servidor vai entender.
  const preview = useMemo(() => {
    if (!phrase.trim()) return null;
    const now = new Date();
    const parsed = parseReminderPhrase(phrase, now, timezone);
    return parsed ? { parsed, description: describeReminderPhrase(parsed, now, timezone) } : { parsed: null, description: "" };
  }, [phrase, timezone]);

  useEffect(() => {
    if (open && !advanced) inputRef.current?.focus();
  }, [open, advanced]);

  useEffect(() => {
    if (!open || !advanced) return;
    startTransition(async () => {
      setContacts(await searchContacts({}));
    });
  }, [open, advanced]);

  function close() {
    setOpen(false);
    setPhrase("");
    setAdvanced(false);
  }

  const canCreate = Boolean(preview?.parsed && !preview.parsed.isPast) && !pending;
  const reminderTitle = preview?.parsed?.subject || title || "Lembrete";

  function handleCreate() {
    if (!canCreate) return;
    startTransition(async () => {
      const result = await createReminderFromPhrase({ phrase, title, itemId: itemId ?? null, sourceType, sourceId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Combinado — te lembro ${result.data.description}.`);
      close();
    });
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Me lembrar de ${title}`}
          className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-black/[.05] hover:text-brand-text dark:text-zinc-500 dark:hover:bg-white/[.08]"
        >
          <Bell className="h-4 w-4" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]"
        >
          <Bell className="h-4 w-4" aria-hidden /> Me lembrar
        </button>
      )}

      {/* Portal no <body>: dentro de uma linha de lista com efeito de "levantar" ao passar o mouse
          (transform), o `fixed` ficava preso à linha e a tela tremia sem parar (bug de 07/10). */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-start sm:p-4 sm:pt-20" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Me lembrar"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
            }}
            className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-t-3xl border border-black/[.08] bg-surface p-5 shadow-2xl sm:rounded-3xl dark:border-white/[.08]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 font-semibold text-black dark:text-zinc-50">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand-text">
                    <BellRing className="h-4 w-4" aria-hidden />
                  </span>
                  Me lembrar
                </h2>
                <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{title || "Lembrete"}</p>
              </div>
              <button type="button" onClick={close} aria-label="Fechar" className="text-xl leading-none text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                ×
              </button>
            </div>

            {advanced ? (
              <ReminderForm
                contacts={contacts}
                defaultTimezone={timezone}
                defaultTitle={reminderTitle}
                itemId={itemId}
                sourceType={sourceType}
                sourceId={sourceId}
                onSaved={close}
                onCancel={() => setAdvanced(false)}
              />
            ) : (
              <>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Quando?
                  <input
                    ref={inputRef}
                    value={phrase}
                    onChange={(e) => setPhrase(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreate();
                      }
                    }}
                    placeholder="amanhã 9h, sexta às 14h, toda segunda…"
                    autoComplete="off"
                    enterKeyHint="done"
                    className="rounded-xl border border-black/[.08] bg-surface-muted px-3 py-2.5 text-base font-normal focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-white/[.08]"
                  />
                </label>

                <div className="flex flex-wrap gap-1.5" aria-label="Sugestões">
                  {QUICK_REMINDER_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setPhrase(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="rounded-full border border-black/[.1] px-2.5 py-1 text-xs text-zinc-600 hover:border-brand hover:text-brand-text dark:border-white/[.14] dark:text-zinc-300"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                <p role="status" className="min-h-10 rounded-xl bg-surface-muted px-3 py-2 text-sm">
                  {!preview ? (
                    <span className="text-zinc-500 dark:text-zinc-400">Escreva do jeito que você fala. Dá pra repetir: &ldquo;todo dia 10&rdquo;, &ldquo;dias úteis 7h&rdquo;.</span>
                  ) : !preview.parsed ? (
                    <span className="text-amber-700 dark:text-amber-400">Não entendi quando. Tente &ldquo;amanhã 9h&rdquo; ou &ldquo;toda segunda&rdquo;.</span>
                  ) : preview.parsed.isPast ? (
                    <span className="text-amber-700 dark:text-amber-400">Esse horário já passou — escolha outro.</span>
                  ) : (
                    <span className="text-zinc-700 dark:text-zinc-200">
                      Vou te lembrar <strong className="font-semibold text-brand-text">{preview.description}</strong>
                      {preview.parsed.subject && (
                        <>
                          {" "}
                          de <strong className="font-semibold">{preview.parsed.subject}</strong>
                        </>
                      )}
                      .
                    </span>
                  )}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={() => setAdvanced(true)} className="text-xs text-zinc-500 hover:underline dark:text-zinc-400">
                    Mais opções (canal, contatos, mensagem)
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!canCreate}
                    className="bg-brand text-brand-fg rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {pending ? "Criando…" : "Criar lembrete"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
