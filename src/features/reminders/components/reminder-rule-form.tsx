"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RELATIONSHIP_LABELS, RELATIONSHIPS } from "@/features/contacts/schemas";
import type { TypeOptionWithFields } from "@/features/items/queries";
import { createReminderRule, updateReminderRule } from "../actions";
import type { ReminderRuleRow } from "../queries";
import { REMINDER_CHANNELS, REMINDER_CHANNEL_LABELS, type ReminderRuleInput, type ReminderRuleKind } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

export interface RulePreset {
  kind: ReminderRuleKind;
  recipientType: "me" | "contacts";
  name: string;
  messageTemplate: string;
  config: Record<string, unknown>;
}

interface ReminderRuleFormProps {
  types: TypeOptionWithFields[];
  rule?: ReminderRuleRow;
  preset?: RulePreset;
  onSaved?: () => void;
  onCancel?: () => void;
}

const VARIABLES_HINT: Record<ReminderRuleKind, string> = {
  event_before: "{{data}}, {{hora}}, {{link}}, {{titulo}}" + " (e {{nome}} se for pros participantes)",
  birthday: "{{contato}} (nome do aniversariante), {{nome}}, {{data}}",
  item_date_field: "{{data}}, {{link}}, {{titulo}}",
  bill_due: "{{titulo}} (descrição da conta), {{data}} (vencimento), {{valor}}" + " (e {{nome}} se for pros contatos)",
};

/** Formulário de criar/editar regra automática (3.10) — os campos de `config` mudam conforme `kind`. */
export function ReminderRuleForm({ types, rule, preset, onSaved, onCancel }: ReminderRuleFormProps) {
  const kind: ReminderRuleKind = (rule?.kind as ReminderRuleKind) ?? preset?.kind ?? "event_before";
  const initialConfig = rule?.config ?? preset?.config ?? {};

  const [name, setName] = useState(rule?.name ?? preset?.name ?? "");
  const [channel, setChannel] = useState(rule?.channel ?? "auto");
  const [recipientType, setRecipientType] = useState(rule?.recipientType ?? preset?.recipientType ?? "contacts");
  const [messageTemplate, setMessageTemplate] = useState(rule?.messageTemplate ?? preset?.messageTemplate ?? "");
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  // event_before
  const [hoursBefore, setHoursBefore] = useState(String((initialConfig.hoursBefore as number | undefined) ?? 24));
  const [minutesBefore, setMinutesBefore] = useState(String((initialConfig.minutesBefore as number | undefined) ?? 30));
  const [onlyRelationships, setOnlyRelationships] = useState<string[]>((initialConfig.onlyRelationships as string[] | undefined) ?? []);

  // birthday
  const [sendToContact, setSendToContact] = useState((initialConfig.sendToContact as boolean | undefined) ?? false);

  // item_date_field
  const [typeId, setTypeId] = useState((initialConfig.typeId as string | undefined) ?? "");
  const [fieldKey, setFieldKey] = useState((initialConfig.fieldKey as string | undefined) ?? "");
  const [daysBefore, setDaysBefore] = useState(String((initialConfig.daysBefore as number | undefined) ?? 1));

  const selectedType = types.find((t) => t.id === typeId);
  const dateFields = (selectedType?.fields ?? []).filter((f) => f.type === "date" || f.type === "datetime");
  const selectedField = dateFields.find((f) => f.key === fieldKey);

  function toggleRelationship(relationship: string) {
    setOnlyRelationships((prev) => (prev.includes(relationship) ? prev.filter((r) => r !== relationship) : [...prev, relationship]));
  }

  function buildConfig(): Record<string, unknown> {
    if (kind === "event_before") {
      return recipientType === "me"
        ? { minutesBefore: Number(minutesBefore) || 30 }
        : { hoursBefore: Number(hoursBefore) || 24, onlyRelationships };
    }
    if (kind === "birthday") return { sendToContact };
    if (kind === "item_date_field") {
      return { typeId: typeId || undefined, fieldKey: fieldKey || undefined, fieldType: selectedField?.type, daysBefore: Number(daysBefore) || 1 };
    }
    if (kind === "bill_due") return { daysBefore: Number(daysBefore) || 3 };
    return {};
  }

  function handleSubmit() {
    setFieldErrors({});
    const input: ReminderRuleInput = {
      name,
      kind,
      channel: channel as ReminderRuleInput["channel"],
      recipientType: kind === "birthday" ? "me" : (recipientType as ReminderRuleInput["recipientType"]),
      messageTemplate,
      enabled,
      config: buildConfig(),
    };

    startTransition(async () => {
      const result = rule ? await updateReminderRule(rule.id, input) : await createReminderRule(input);
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success(rule ? "Regra atualizada." : "Regra criada.");
      onSaved?.();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelClassName}>
          Nome*
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} disabled={pending} />
          {fieldErrors.name && <span className="text-red-500">{fieldErrors.name[0]}</span>}
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

        {kind === "event_before" && (
          <label className={labelClassName}>
            Para quem
            <select value={recipientType} onChange={(e) => setRecipientType(e.target.value as "me" | "contacts")} className={inputClassName} disabled={pending}>
              <option value="contacts">Participantes da reunião</option>
              <option value="me">Eu</option>
            </select>
          </label>
        )}

        {kind === "bill_due" && (
          <label className={labelClassName}>
            Para quem
            <select value={recipientType} onChange={(e) => setRecipientType(e.target.value as "me" | "contacts")} className={inputClassName} disabled={pending}>
              <option value="me">Eu (contas a pagar)</option>
              <option value="contacts">Contatos (contas a receber, com opt-in)</option>
            </select>
          </label>
        )}

        {kind === "bill_due" && (
          <label className={labelClassName}>
            Dias antes
            <input type="number" min={1} value={daysBefore} onChange={(e) => setDaysBefore(e.target.value)} className={`${inputClassName} w-24`} disabled={pending} />
            <span className="font-normal text-zinc-400">
              {recipientType === "me" ? "E no dia do vencimento." : "E no dia seguinte ao vencimento (cobrança)."}
            </span>
          </label>
        )}

        {kind === "event_before" && recipientType === "contacts" && (
          <label className={labelClassName}>
            Horas antes
            <input type="number" min={1} value={hoursBefore} onChange={(e) => setHoursBefore(e.target.value)} className={`${inputClassName} w-24`} disabled={pending} />
          </label>
        )}
        {kind === "event_before" && recipientType === "me" && (
          <label className={labelClassName}>
            Minutos antes
            <input type="number" min={1} value={minutesBefore} onChange={(e) => setMinutesBefore(e.target.value)} className={`${inputClassName} w-24`} disabled={pending} />
          </label>
        )}

        {kind === "item_date_field" && (
          <>
            <label className={labelClassName}>
              Tipo de objeto
              <select
                value={typeId}
                onChange={(e) => {
                  setTypeId(e.target.value);
                  setFieldKey("");
                }}
                className={inputClassName}
                disabled={pending}
              >
                <option value="">Escolha um tipo</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Campo de data
              <select value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} className={inputClassName} disabled={pending || !typeId}>
                <option value="">Escolha um campo</option>
                {dateFields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Dias antes
              <input type="number" min={1} value={daysBefore} onChange={(e) => setDaysBefore(e.target.value)} className={`${inputClassName} w-24`} disabled={pending} />
            </label>
          </>
        )}
      </div>

      {kind === "event_before" && recipientType === "contacts" && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Só pra relações (vazio = todas)</span>
          <div className="flex flex-wrap gap-3">
            {RELATIONSHIPS.map((r) => (
              <label key={r} className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={onlyRelationships.includes(r)} onChange={() => toggleRelationship(r)} disabled={pending} />
                {RELATIONSHIP_LABELS[r]}
              </label>
            ))}
          </div>
        </div>
      )}

      {kind === "birthday" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sendToContact} onChange={(e) => setSendToContact(e.target.checked)} disabled={pending} />
          Também enviar direto pro contato (além do push de sugestão pra mim)
        </label>
      )}

      <label className={labelClassName}>
        Mensagem* (variáveis: {VARIABLES_HINT[kind]})
        <textarea value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)} rows={3} className={`${inputClassName} w-full`} disabled={pending} />
        {fieldErrors.messageTemplate && <span className="text-red-500">{fieldErrors.messageTemplate[0]}</span>}
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={pending} />
        Ativa
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !name.trim() || !messageTemplate.trim()}
          className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Salvando..." : rule ? "Salvar" : "Criar regra"}
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
