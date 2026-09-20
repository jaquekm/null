"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TypeOptionWithFields } from "@/features/items/queries";
import { deleteReminderRule, setReminderRuleEnabled } from "../actions";
import type { ReminderRuleRow } from "../queries";
import { REMINDER_CHANNEL_LABELS, type ReminderChannel } from "../schemas";
import { ReminderRuleForm, type RulePreset } from "./reminder-rule-form";

const PRESETS: (RulePreset & { label: string; description: string })[] = [
  {
    kind: "event_before",
    recipientType: "contacts",
    label: "Lembrete de reunião para participantes",
    description: "Avisa os convidados (contatos com opt-in) X horas antes.",
    name: "Lembrete de reunião para participantes",
    messageTemplate: "Oi {{nome}}, passando pra lembrar da nossa reunião {{data}} às {{hora}}. {{link}}",
    config: { hoursBefore: 24 },
  },
  {
    kind: "event_before",
    recipientType: "me",
    label: "Lembrete de reunião para mim",
    description: "Push X minutos antes, com link pra nota da reunião.",
    name: "Lembrete de reunião para mim",
    messageTemplate: "Sua reunião é daqui a pouco, {{data}} às {{hora}}. {{link}}",
    config: { minutesBefore: 30 },
  },
  {
    kind: "birthday",
    recipientType: "me",
    label: "Aniversários",
    description: "No dia, às 9h: push com sugestão de mensagem (e, se quiser, envio direto ao contato).",
    name: "Aniversários",
    messageTemplate: "Parabéns, {{nome}}! Tudo de bom nesse novo ano de vida. 🎉",
    config: { sendToContact: false },
  },
  {
    kind: "item_date_field",
    recipientType: "me",
    label: "Campo de data de item",
    description: "Ex.: Tarefa.prazo — lembrar X dias antes.",
    name: "Campo de data",
    messageTemplate: "Lembrete: {{titulo}} vence {{data}}. {{link}}",
    config: { daysBefore: 1 },
  },
];

const KIND_LABELS: Record<string, string> = {
  event_before: "Reunião",
  birthday: "Aniversário",
  item_date_field: "Campo de data",
};

export function ReminderRulesWorkspace({ types, initialRules }: { types: TypeOptionWithFields[]; initialRules: ReminderRuleRow[] }) {
  const router = useRouter();
  const [showPresets, setShowPresets] = useState(false);
  const [formPreset, setFormPreset] = useState<RulePreset | null>(null);
  const [editingRule, setEditingRule] = useState<ReminderRuleRow | null>(null);
  const [, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function closeForm() {
    setFormPreset(null);
    setEditingRule(null);
    setShowPresets(false);
  }

  function handleToggle(rule: ReminderRuleRow) {
    startTransition(async () => {
      const result = await setReminderRuleEnabled(rule.id, !rule.enabled);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      refresh();
    });
  }

  function handleDelete(rule: ReminderRuleRow) {
    if (!window.confirm(`Apagar a regra "${rule.name}"? Lembretes já gerados por ela continuam existindo.`)) return;
    startTransition(async () => {
      const result = await deleteReminderRule(rule.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Regra apagada.");
      refresh();
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Regras automáticas</h1>
        <button
          type="button"
          onClick={() => setShowPresets((v) => !v)}
          className="bg-foreground text-background flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Nova regra
        </button>
      </div>

      {showPresets && !formPreset && !editingRule && (
        <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Escolha uma regra pronta pra ajustar:</p>
          {PRESETS.map((preset) => (
            <button
              key={`${preset.kind}-${preset.recipientType}`}
              type="button"
              onClick={() => setFormPreset(preset)}
              className="flex flex-col items-start rounded-lg border border-black/[.08] px-3 py-2 text-left text-sm hover:bg-black/[.02] dark:border-white/[.08] dark:hover:bg-white/[.03]"
            >
              <span className="font-medium text-black dark:text-zinc-50">{preset.label}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{preset.description}</span>
            </button>
          ))}
        </div>
      )}

      {(formPreset || editingRule) && (
        <div className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
          <ReminderRuleForm
            types={types}
            rule={editingRule ?? undefined}
            preset={formPreset ?? undefined}
            onSaved={() => {
              closeForm();
              refresh();
            }}
            onCancel={closeForm}
          />
        </div>
      )}

      {initialRules.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma regra ainda. Escolha uma pronta acima pra começar.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {initialRules.map((rule) => (
            <li key={rule.id} className="flex flex-col gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-black dark:text-zinc-50">{rule.name}</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {KIND_LABELS[rule.kind] ?? rule.kind} · {REMINDER_CHANNEL_LABELS[rule.channel as ReminderChannel] ?? rule.channel}
                  {!rule.enabled && " · Desativada"}
                </span>
              </div>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{rule.messageTemplate}</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <button type="button" onClick={() => setEditingRule(rule)} className="text-zinc-500 hover:underline dark:text-zinc-400">
                  Editar
                </button>
                <button type="button" onClick={() => handleToggle(rule)} className="text-zinc-500 hover:underline dark:text-zinc-400">
                  {rule.enabled ? "Desativar" : "Ativar"}
                </button>
                <button type="button" onClick={() => handleDelete(rule)} className="flex items-center gap-1 text-red-500 hover:underline">
                  <Trash2 className="h-3 w-3" /> Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
