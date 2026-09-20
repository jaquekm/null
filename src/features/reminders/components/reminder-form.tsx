"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ContactRow } from "@/features/contacts/queries";
import { createReminder, updateReminder } from "../actions";
import { parseRecurrencePreset, type RecurrencePreset, type Weekday } from "../lib/recurrence";
import { buildTemplateVars, renderTemplate } from "../lib/render-template";
import { REMINDER_CHANNELS, REMINDER_CHANNEL_LABELS, type ReminderInput } from "../schemas";
import type { ReminderListRow } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: "MO", label: "Seg" },
  { value: "TU", label: "Ter" },
  { value: "WE", label: "Qua" },
  { value: "TH", label: "Qui" },
  { value: "FR", label: "Sex" },
  { value: "SA", label: "Sáb" },
  { value: "SU", label: "Dom" },
];

const RECURRENCE_KIND_LABELS: Record<RecurrencePreset["kind"], string> = {
  once: "Uma vez",
  daily: "Diariamente",
  weekdays: "Dias úteis",
  weekly: "Semanalmente (escolher dias)",
  monthly_day: "Mensalmente (dia do mês)",
  monthly_last_weekday: "Mensalmente (último dia da semana)",
  yearly: "Anualmente",
  custom: "Personalizado (RRULE)",
};

interface VariableRow {
  key: string;
  value: string;
}

interface ReminderFormProps {
  contacts: ContactRow[];
  defaultTimezone: string;
  reminder?: ReminderListRow;
  defaultTitle?: string;
  defaultRecipientType?: "me" | "contacts";
  defaultContactIds?: string[];
  itemId?: string | null;
  sourceType?: string;
  sourceId?: string;
  onSaved?: (id: string) => void;
  onCancel?: () => void;
}

/** Formulário de criar/editar lembrete (3.8) — mesmo componente pros dois casos, como `ContactForm` (3.3). */
export function ReminderForm({
  contacts,
  defaultTimezone,
  reminder,
  defaultTitle,
  defaultRecipientType,
  defaultContactIds,
  itemId,
  sourceType,
  sourceId,
  onSaved,
  onCancel,
}: ReminderFormProps) {
  const timezone = reminder?.timezone ?? defaultTimezone;
  const initialDateTime = reminder ? formatInTimeZone(new Date(reminder.sendAt), timezone, "yyyy-MM-dd'T'HH:mm") : "";
  const [initialDate = "", initialTime = ""] = initialDateTime ? initialDateTime.split("T") : ["", ""];

  const [title, setTitle] = useState(reminder?.title ?? defaultTitle ?? "");
  const [messageTemplate, setMessageTemplate] = useState(reminder?.messageTemplate ?? "");
  const [channel, setChannel] = useState(reminder?.channel ?? "auto");
  const [recipientType, setRecipientType] = useState(reminder?.recipientType ?? defaultRecipientType ?? "me");
  const [contactIds, setContactIds] = useState<string[]>(reminder?.contactIds ?? defaultContactIds ?? []);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime || "09:00");
  const [recurrence, setRecurrence] = useState<RecurrencePreset>(parseRecurrencePreset(reminder?.rrule ?? null));
  const [endsAt, setEndsAt] = useState(reminder?.endsAt ? formatInTimeZone(new Date(reminder.endsAt), timezone, "yyyy-MM-dd") : "");
  const [variables, setVariables] = useState<VariableRow[]>([]);
  const [previewContactId, setPreviewContactId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  const previewContact = contacts.find((c) => c.id === previewContactId) ?? (recipientType === "contacts" ? contacts.find((c) => c.id === contactIds[0]) : undefined);

  const preview = useMemo(() => {
    const variablesRecord = Object.fromEntries(variables.filter((v) => v.key.trim()).map((v) => [v.key.trim(), v.value]));
    const occurrenceAt = date && time ? new Date(`${date}T${time}:00`) : new Date();
    return renderTemplate(
      messageTemplate,
      buildTemplateVars({
        title: title || "(sem título)",
        occurrenceAt,
        timezone,
        recipient: previewContact ? { nickname: previewContact.nickname, name: previewContact.name } : null,
        extra: variablesRecord,
      }),
    );
  }, [messageTemplate, date, time, timezone, title, previewContact, variables]);

  function toggleContact(id: string) {
    setContactIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function toggleWeeklyDay(day: Weekday) {
    setRecurrence((prev) => {
      if (prev.kind !== "weekly") return { kind: "weekly", days: [day] };
      const days = prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day];
      return { kind: "weekly", days };
    });
  }

  function handleSubmit() {
    setFieldErrors({});
    const input: ReminderInput = {
      title,
      messageTemplate,
      channel: channel as ReminderInput["channel"],
      recipientType: recipientType as ReminderInput["recipientType"],
      contactIds,
      date,
      time,
      timezone,
      recurrence,
      endsAt,
      variables: Object.fromEntries(variables.filter((v) => v.key.trim()).map((v) => [v.key.trim(), v.value])),
      itemId: itemId ?? null,
      sourceType,
      sourceId,
    };

    startTransition(async () => {
      if (reminder) {
        const result = await updateReminder(reminder.id, input);
        if (!result.ok) {
          toast.error(result.error);
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
          return;
        }
        toast.success("Lembrete atualizado.");
        onSaved?.(reminder.id);
        return;
      }

      const result = await createReminder(input);
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success("Lembrete criado.");
      onSaved?.(result.data.id);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelClassName}>
          Título*
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClassName} disabled={pending} />
          {fieldErrors.title && <span className="text-red-500">{fieldErrors.title[0]}</span>}
        </label>
        <label className={labelClassName}>
          Canal
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClassName} disabled={pending}>
            {REMINDER_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {REMINDER_CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClassName}>
          Para quem
          <select value={recipientType} onChange={(e) => setRecipientType(e.target.value)} className={inputClassName} disabled={pending}>
            <option value="me">Eu</option>
            <option value="contacts">Contatos</option>
          </select>
        </label>
        <label className={labelClassName}>
          Data
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClassName} disabled={pending} />
        </label>
        <label className={labelClassName}>
          Hora
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClassName} disabled={pending} />
        </label>
        <label className={labelClassName}>
          Termina em (opcional)
          <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClassName} disabled={pending} />
        </label>
      </div>

      {recipientType === "contacts" && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Contatos*</span>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-black/[.08] p-2 dark:border-white/[.08]">
            {contacts.length === 0 && <span className="text-xs text-zinc-400">Nenhum contato cadastrado.</span>}
            {contacts.map((contact) => (
              <label key={contact.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={contactIds.includes(contact.id)} onChange={() => toggleContact(contact.id)} disabled={pending} />
                {contact.name}
              </label>
            ))}
          </div>
          {fieldErrors.contactIds && <span className="text-xs text-red-500">{fieldErrors.contactIds[0]}</span>}
        </div>
      )}

      <label className={labelClassName}>
        Recorrência
        <select
          value={recurrence.kind}
          onChange={(e) => {
            const kind = e.target.value as RecurrencePreset["kind"];
            if (kind === "weekly") setRecurrence({ kind, days: [] });
            else if (kind === "monthly_day") setRecurrence({ kind, day: 1 });
            else if (kind === "monthly_last_weekday") setRecurrence({ kind, day: "FR" });
            else if (kind === "custom") setRecurrence({ kind, rrule: "" });
            else setRecurrence({ kind });
          }}
          className={inputClassName}
          disabled={pending}
        >
          {Object.entries(RECURRENCE_KIND_LABELS).map(([kind, label]) => (
            <option key={kind} value={kind}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {recurrence.kind === "weekly" && (
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <label key={day.value} className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={recurrence.days.includes(day.value)} onChange={() => toggleWeeklyDay(day.value)} disabled={pending} />
              {day.label}
            </label>
          ))}
        </div>
      )}
      {recurrence.kind === "monthly_day" && (
        <label className={labelClassName}>
          Dia do mês
          <input
            type="number"
            min={1}
            max={31}
            value={recurrence.day}
            onChange={(e) => setRecurrence({ kind: "monthly_day", day: Number(e.target.value) })}
            className={`${inputClassName} w-24`}
            disabled={pending}
          />
        </label>
      )}
      {recurrence.kind === "monthly_last_weekday" && (
        <label className={labelClassName}>
          Último dia da semana
          <select
            value={recurrence.day}
            onChange={(e) => setRecurrence({ kind: "monthly_last_weekday", day: e.target.value as Weekday })}
            className={inputClassName}
            disabled={pending}
          >
            {WEEKDAYS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {recurrence.kind === "custom" && (
        <label className={labelClassName}>
          RRULE personalizada
          <input
            value={recurrence.rrule}
            onChange={(e) => setRecurrence({ kind: "custom", rrule: e.target.value })}
            placeholder="DTSTART:...Z&#10;RRULE:FREQ=..."
            className={inputClassName}
            disabled={pending}
          />
        </label>
      )}

      <label className={labelClassName}>
        Mensagem* (use {"{{nome}}"}, {"{{data}}"}, {"{{hora}}"}, {"{{valor}}"}, {"{{link}}"}, {"{{titulo}}"} ou variáveis suas)
        <textarea
          value={messageTemplate}
          onChange={(e) => setMessageTemplate(e.target.value)}
          rows={3}
          className={`${inputClassName} w-full`}
          disabled={pending}
        />
        {fieldErrors.messageTemplate && <span className="text-red-500">{fieldErrors.messageTemplate[0]}</span>}
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Variáveis extras</span>
        {variables.map((row, index) => (
          <div key={index} className="flex gap-2">
            <input
              value={row.key}
              onChange={(e) => setVariables((prev) => prev.map((r, i) => (i === index ? { ...r, key: e.target.value } : r)))}
              placeholder="nome_da_variável"
              className={`${inputClassName} flex-1`}
              disabled={pending}
            />
            <input
              value={row.value}
              onChange={(e) => setVariables((prev) => prev.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))}
              placeholder="valor de exemplo"
              className={`${inputClassName} flex-1`}
              disabled={pending}
            />
            <button type="button" onClick={() => setVariables((prev) => prev.filter((_, i) => i !== index))} disabled={pending} className="text-xs text-zinc-400 hover:text-red-500">
              Remover
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setVariables((prev) => [...prev, { key: "", value: "" }])}
          disabled={pending}
          className="self-start text-xs text-zinc-500 hover:underline dark:text-zinc-400"
        >
          + Adicionar variável
        </button>
      </div>

      {recipientType === "contacts" && contacts.length > 0 && (
        <label className={labelClassName}>
          Pré-visualizar com o contato
          <select value={previewContactId} onChange={(e) => setPreviewContactId(e.target.value)} className={inputClassName} disabled={pending}>
            <option value="">Primeiro contato selecionado</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="rounded-lg border border-dashed border-black/[.12] p-3 text-sm text-zinc-600 dark:border-white/[.16] dark:text-zinc-300">
        <span className="mb-1 block text-xs font-medium text-zinc-400">Pré-visualização</span>
        {preview || <span className="text-zinc-400">A mensagem aparece aqui conforme você digita.</span>}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !title.trim() || !messageTemplate.trim() || !date || !time}
          className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Salvando..." : reminder ? "Salvar" : "Criar lembrete"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={pending} className="self-start rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
