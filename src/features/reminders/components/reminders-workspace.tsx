"use client";

import { formatInTimeZone } from "date-fns-tz";
import { Bell, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ContactRow } from "@/features/contacts/queries";
import { cancelReminder, pauseReminder, resumeReminder, sendReminderNow } from "../actions";
import type { DeliveryListRow, ReminderListRow } from "../queries";
import { REMINDER_CHANNEL_LABELS, type ReminderChannel } from "../schemas";
import { ReminderForm } from "./reminder-form";

type Tab = "upcoming" | "recurring" | "sent" | "failed";

const TABS: { value: Tab; label: string }[] = [
  { value: "upcoming", label: "Próximos" },
  { value: "recurring", label: "Recorrentes" },
  { value: "sent", label: "Enviados" },
  { value: "failed", label: "Com falha" },
];

const SKIP_REASON_LABELS: Record<string, string> = {
  opt_out: "Sem opt-in / descadastrado",
  quiet_hours: "Horário silencioso",
  no_destination: "Sem destino cadastrado",
  rate_limit: "Limite diário atingido",
};

function formatDateTime(iso: string, timezone: string): string {
  return formatInTimeZone(new Date(iso), timezone, "dd/MM/yyyy HH:mm");
}

interface RemindersWorkspaceProps {
  contacts: ContactRow[];
  defaultTimezone: string;
  initialUpcoming: ReminderListRow[];
  initialRecurring: ReminderListRow[];
  initialSent: DeliveryListRow[];
  initialFailed: DeliveryListRow[];
}

export function RemindersWorkspace({ contacts, defaultTimezone, initialUpcoming, initialRecurring, initialSent, initialFailed }: RemindersWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ReminderListRow | null>(null);
  const [, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function handleAction(action: () => Promise<{ ok: boolean; error?: string }>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível concluir.");
        return;
      }
      toast.success(successMessage);
      refresh();
    });
  }

  const reminders = tab === "upcoming" ? initialUpcoming : tab === "recurring" ? initialRecurring : [];
  const deliveries = tab === "sent" ? initialSent : tab === "failed" ? initialFailed : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-black dark:text-zinc-50">
          <Bell className="h-5 w-5" /> Lembretes
        </h1>
        <div className="flex gap-2">
          <Link
            href="/lembretes/regras"
            className="flex items-center gap-1.5 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]"
          >
            <Settings2 className="h-4 w-4" /> Regras automáticas
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="bg-foreground text-background flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Novo lembrete
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
          <ReminderForm
            contacts={contacts}
            defaultTimezone={defaultTimezone}
            reminder={editing ?? undefined}
            onSaved={() => {
              setShowForm(false);
              setEditing(null);
              refresh();
            }}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
          />
        </div>
      )}

      <div className="flex gap-1 border-b border-black/[.08] dark:border-white/[.08]">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.value ? "border-b-2 border-black text-black dark:border-white dark:text-white" : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === "upcoming" || tab === "recurring") &&
        (reminders.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum lembrete aqui.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reminders.map((reminder) => (
              <li key={reminder.id} className="flex flex-col gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-black dark:text-zinc-50">{reminder.title}</span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {formatDateTime(reminder.sendAt, reminder.timezone)} · {REMINDER_CHANNEL_LABELS[reminder.channel as ReminderChannel]}
                    {reminder.status === "paused" && " · Pausado"}
                  </span>
                </div>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{reminder.messageTemplate}</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(reminder);
                      setShowForm(true);
                    }}
                    className="text-zinc-500 hover:underline dark:text-zinc-400"
                  >
                    Editar
                  </button>
                  {reminder.status === "scheduled" && (
                    <button type="button" onClick={() => handleAction(() => pauseReminder(reminder.id), "Lembrete pausado.")} className="text-zinc-500 hover:underline dark:text-zinc-400">
                      Pausar
                    </button>
                  )}
                  {reminder.status === "paused" && (
                    <button type="button" onClick={() => handleAction(() => resumeReminder(reminder.id), "Lembrete retomado.")} className="text-zinc-500 hover:underline dark:text-zinc-400">
                      Retomar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`Enviar "${reminder.title}" agora, ignorando o horário programado?`)) return;
                      handleAction(() => sendReminderNow(reminder.id), "Lembrete enviado.");
                    }}
                    className="text-zinc-500 hover:underline dark:text-zinc-400"
                  >
                    Enviar agora
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`Cancelar "${reminder.title}"?`)) return;
                      handleAction(() => cancelReminder(reminder.id), "Lembrete cancelado.");
                    }}
                    className="text-red-500 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {(tab === "sent" || tab === "failed") &&
        (deliveries.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma entrega aqui.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {deliveries.map((delivery) => (
              <li key={delivery.id} className="flex flex-col gap-1 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-black dark:text-zinc-50">{delivery.reminderTitle}</span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">{formatDateTime(delivery.occurrenceAt, defaultTimezone)}</span>
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {delivery.contactName ?? "Eu"} · {REMINDER_CHANNEL_LABELS[delivery.channel as ReminderChannel] ?? delivery.channel}
                  {delivery.destination ? ` · ${delivery.destination}` : ""}
                </span>
                {tab === "failed" && <span className="text-xs text-red-500">{delivery.error ?? "Falha ao enviar."}</span>}
                {delivery.skipReason && <span className="text-xs text-amber-600 dark:text-amber-400">{SKIP_REASON_LABELS[delivery.skipReason] ?? delivery.skipReason}</span>}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
