"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { searchContacts } from "@/features/contacts/actions";
import type { ContactRow } from "@/features/contacts/queries";
import { saveReportDefinition } from "../actions";
import type { RelativePeriod } from "../lib/resolve-period";
import { reportScheduleToRRule, REPORT_SCHEDULE_PRESET_LABELS, type ReportSchedulePreset } from "../lib/schedule-presets";
import { reportChannels, type ReportChannel, type ReportKind } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

const PERIOD_LABELS: Record<RelativePeriod, string> = {
  last_month: "Mês passado",
  this_month: "Este mês",
  last_7_days: "Últimos 7 dias",
  last_quarter: "Trimestre passado",
  this_year: "Este ano",
  custom: "Personalizado",
};

const CHANNEL_LABELS: Record<ReportChannel, string> = { push: "Push (pra mim)", email: "E-mail (pra mim)", whatsapp: "WhatsApp (contatos)" };

function defaultPeriodFor(preset: ReportSchedulePreset["kind"]): RelativePeriod {
  if (preset === "monthly_day1_8h") return "last_month";
  if (preset === "weekly_monday_7h") return "last_7_days";
  return "this_month";
}

/**
 * "Agendar" (6.4) — cria uma `report_definitions` com agendamento a partir
 * de um relatório pronto. Mesma técnica de conversão preset→RRULE do
 * agendamento de lembretes (3.8), só que restrita aos 3 presets do
 * enunciado (`schedule-presets.ts`). `timezone` vem do servidor (`page.tsx`)
 * — a RRULE já nasce com o `DTSTART` certo pro fuso do dono.
 */
export function ScheduleReportDialog({ kind, name, timezone, onClose }: { kind: ReportKind; name: string; timezone: string; onClose: () => void }) {
  const [preset, setPreset] = useState<ReportSchedulePreset["kind"]>("monthly_day1_8h");
  const [customRrule, setCustomRrule] = useState("");
  const [period, setPeriod] = useState<RelativePeriod>(defaultPeriodFor("monthly_day1_8h"));
  const [channels, setChannels] = useState<ReportChannel[]>(["push"]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [includeAiSummary, setIncludeAiSummary] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    startTransition(async () => {
      setContacts(await searchContacts({}));
    });
  }, []);

  function toggleChannel(channel: ReportChannel, checked: boolean) {
    setChannels((prev) => (checked ? [...prev, channel] : prev.filter((c) => c !== channel)));
  }

  function toggleContact(id: string, checked: boolean) {
    setContactIds((prev) => (checked ? [...prev, id] : prev.filter((c) => c !== id)));
  }

  function handlePresetChange(next: ReportSchedulePreset["kind"]) {
    setPreset(next);
    setPeriod(defaultPeriodFor(next));
  }

  function handleSave() {
    if (channels.length === 0) {
      toast.error("Escolha ao menos um canal de entrega.");
      return;
    }
    const schedulePreset: ReportSchedulePreset = preset === "custom" ? { kind: "custom", rrule: customRrule } : { kind: preset };
    const scheduleRrule = reportScheduleToRRule(schedulePreset, timezone);

    startTransition(async () => {
      const result = await saveReportDefinition(null, {
        name,
        kind,
        params: { period, spaceId: null },
        scheduleRrule,
        deliverTo: { me: channels.includes("push") || channels.includes("email"), contactIds },
        channels,
        includeAiSummary,
        enabled: true,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Agendamento criado.");
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Agendar &quot;{name}&quot;</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className={labelClassName}>
            Frequência
            <select value={preset} onChange={(e) => handlePresetChange(e.target.value as ReportSchedulePreset["kind"])} className={inputClassName} disabled={pending}>
              {(["monthly_day1_8h", "weekly_monday_7h", "custom"] as const).map((p) => (
                <option key={p} value={p}>
                  {REPORT_SCHEDULE_PRESET_LABELS[p]}
                </option>
              ))}
            </select>
          </label>

          {preset === "custom" && (
            <label className={labelClassName}>
              RRULE personalizada
              <input value={customRrule} onChange={(e) => setCustomRrule(e.target.value)} placeholder="FREQ=DAILY" className={inputClassName} disabled={pending} />
            </label>
          )}

          <label className={labelClassName}>
            Período do relatório
            <select value={period} onChange={(e) => setPeriod(e.target.value as RelativePeriod)} className={inputClassName} disabled={pending}>
              {Object.entries(PERIOD_LABELS)
                .filter(([value]) => value !== "custom")
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Entregar por</span>
            {reportChannels.map((channel) => (
              <label key={channel} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={channels.includes(channel)} onChange={(e) => toggleChannel(channel, e.target.checked)} disabled={pending} />
                {CHANNEL_LABELS[channel]}
              </label>
            ))}
          </div>

          {channels.includes("whatsapp") && (
            <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-black/[.08] p-2 dark:border-white/[.08]">
              {contacts.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Nenhum contato encontrado.</p>
              ) : (
                contacts.map((contact) => (
                  <label key={contact.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={contactIds.includes(contact.id)} onChange={(e) => toggleContact(contact.id, e.target.checked)} disabled={pending} />
                    {contact.name}
                    {!contact.whatsappOptIn && <span className="text-xs text-amber-600 dark:text-amber-400">(sem opt-in)</span>}
                  </label>
                ))
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeAiSummary} onChange={(e) => setIncludeAiSummary(e.target.checked)} disabled={pending} />
            Incluir resumo por IA
          </label>

          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Salvar agendamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
