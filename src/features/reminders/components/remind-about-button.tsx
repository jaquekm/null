"use client";

import { Bell } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { searchContacts } from "@/features/contacts/actions";
import type { ContactRow } from "@/features/contacts/queries";
import { ReminderForm } from "./reminder-form";

interface RemindAboutButtonProps {
  defaultTitle: string;
  defaultTimezone: string;
  itemId?: string | null;
  sourceType?: string;
  sourceId?: string;
  defaultRecipientType?: "me" | "contacts";
  defaultContactIds?: string[];
}

/** Botão "Lembrar sobre isto" (3.8) — em itens e contatos, abre o mesmo `ReminderForm` já pré-preenchido. */
export function RemindAboutButton({
  defaultTitle,
  defaultTimezone,
  itemId,
  sourceType,
  sourceId,
  defaultRecipientType,
  defaultContactIds,
}: RemindAboutButtonProps) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      setContacts(await searchContacts({}));
    });
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]"
      >
        <Bell className="h-4 w-4" /> Lembrar sobre isto
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-black dark:text-zinc-50">Lembrar sobre isto</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                ×
              </button>
            </div>
            <ReminderForm
              contacts={contacts}
              defaultTimezone={defaultTimezone}
              defaultTitle={defaultTitle}
              defaultRecipientType={defaultRecipientType}
              defaultContactIds={defaultContactIds}
              itemId={itemId}
              sourceType={sourceType}
              sourceId={sourceId}
              onSaved={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
