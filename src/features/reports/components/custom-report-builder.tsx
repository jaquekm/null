"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { TypeWithFields } from "@/features/automations/queries";
import type { CategoryRow } from "@/features/financas/queries";
import type { SidebarSpace } from "@/features/spaces/queries";
import { previewCustomReport, saveCustomReportDefinition } from "../actions";
import type { ReportBlock } from "../lib/blocks";
import type { MetricKind, Visualization } from "../lib/custom-report";
import type { RelativePeriod } from "../lib/resolve-period";
import { GenericReportView } from "./generic-report-view";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const PERIOD_LABELS: Record<RelativePeriod, string> = {
  last_month: "Mês passado",
  this_month: "Este mês",
  last_7_days: "Últimos 7 dias",
  last_quarter: "Trimestre passado",
  this_year: "Este ano",
  custom: "Personalizado",
};

const GROUP_BY_LABELS: Record<string, string> = { field: "Campo", tag: "Tag", space: "Espaço", category: "Categoria", period: "Período", none: "Sem agrupamento" };
const METRIC_LABELS: Record<MetricKind, string> = { count: "Contagem", sum: "Soma", avg: "Média", min: "Mínimo", max: "Máximo" };
const VISUALIZATION_LABELS: Record<Visualization, string> = { table: "Tabela", bars: "Barras", line: "Linha", donut: "Rosca", number: "Número único" };

let sectionIdCounter = 0;
function nextSectionId(): string {
  sectionIdCounter += 1;
  return `s${sectionIdCounter}`;
}

interface SectionDraft {
  id: string;
  title: string;
  sourceKind: "items" | "transactions";
  typeId: string;
  transactionCategoryId: string;
  transactionType: "" | "expense" | "income";
  groupByKind: "field" | "tag" | "space" | "category" | "period" | "none";
  groupByField: string;
  groupByGranularity: "day" | "week" | "month";
  metricKind: MetricKind;
  metricField: string;
  visualization: Visualization;
}

function newSection(): SectionDraft {
  return {
    id: nextSectionId(),
    title: "Nova seção",
    sourceKind: "items",
    typeId: "",
    transactionCategoryId: "",
    transactionType: "",
    groupByKind: "none",
    groupByField: "",
    groupByGranularity: "month",
    metricKind: "count",
    metricField: "",
    visualization: "table",
  };
}

/** Traduz um rascunho de seção pro shape que `customReportConfigSchema`/o generator esperam (6.3). */
function sectionDraftToConfig(draft: SectionDraft) {
  const groupBy =
    draft.groupByKind === "field"
      ? { kind: "field" as const, field: draft.groupByField }
      : draft.groupByKind === "period"
        ? { kind: "period" as const, granularity: draft.groupByGranularity }
        : { kind: draft.groupByKind };
  const metric = draft.metricKind === "count" ? { kind: "count" as const } : { kind: draft.metricKind, field: draft.metricField };
  const source =
    draft.sourceKind === "items"
      ? { kind: "items" as const, typeId: draft.typeId, filters: [] }
      : {
          kind: "transactions" as const,
          categoryId: draft.transactionCategoryId || undefined,
          type: draft.transactionType || undefined,
        };
  return { id: draft.id, title: draft.title, source, groupBy, metric, visualization: draft.visualization };
}

function fieldsForType(types: TypeWithFields[], typeId: string) {
  return types.find((t) => t.id === typeId)?.fields ?? [];
}

const NUMERIC_FIELD_TYPES = new Set(["number", "money", "percent", "duration", "rating"]);

function SectionEditor({
  draft,
  types,
  categories,
  onChange,
  onRemove,
}: {
  draft: SectionDraft;
  types: TypeWithFields[];
  categories: CategoryRow[];
  onChange: (next: SectionDraft) => void;
  onRemove: () => void;
}) {
  const fields = fieldsForType(types, draft.typeId);
  const groupableFields = fields.filter((f) => ["select", "multi_select", "checkbox", "contact", "relation", "text"].includes(f.type));
  const numericFields = fields.filter((f) => NUMERIC_FIELD_TYPES.has(f.type));

  function set<K extends keyof SectionDraft>(key: K, value: SectionDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
      <div className="flex items-center gap-2">
        <input value={draft.title} onChange={(e) => set("title", e.target.value)} className={`${inputClassName} flex-1 font-medium`} placeholder="Título da seção" />
        <button type="button" onClick={onRemove} aria-label="Remover seção" className="text-zinc-400 hover:text-red-500">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={draft.sourceKind} onChange={(e) => set("sourceKind", e.target.value as SectionDraft["sourceKind"])} className={inputClassName}>
          <option value="items">Itens de um tipo</option>
          <option value="transactions">Lançamentos financeiros</option>
        </select>

        {draft.sourceKind === "items" ? (
          <select value={draft.typeId} onChange={(e) => set("typeId", e.target.value)} className={inputClassName}>
            <option value="">Escolha o tipo...</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <select value={draft.transactionType} onChange={(e) => set("transactionType", e.target.value as SectionDraft["transactionType"])} className={inputClassName}>
              <option value="">Entradas e saídas</option>
              <option value="expense">Só saídas</option>
              <option value="income">Só entradas</option>
            </select>
            <select value={draft.transactionCategoryId} onChange={(e) => set("transactionCategoryId", e.target.value)} className={inputClassName}>
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={draft.groupByKind} onChange={(e) => set("groupByKind", e.target.value as SectionDraft["groupByKind"])} className={inputClassName}>
          {Object.entries(GROUP_BY_LABELS)
            .filter(([kind]) => draft.sourceKind === "transactions" || kind !== "category")
            .filter(([kind]) => draft.sourceKind === "items" || (kind !== "field" && kind !== "tag" && kind !== "space"))
            .map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
        </select>
        {draft.groupByKind === "field" && (
          <select value={draft.groupByField} onChange={(e) => set("groupByField", e.target.value)} className={inputClassName}>
            <option value="">Escolha o campo...</option>
            {groupableFields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        )}
        {draft.groupByKind === "period" && (
          <select value={draft.groupByGranularity} onChange={(e) => set("groupByGranularity", e.target.value as SectionDraft["groupByGranularity"])} className={inputClassName}>
            <option value="day">Por dia</option>
            <option value="week">Por semana</option>
            <option value="month">Por mês</option>
          </select>
        )}

        <select value={draft.metricKind} onChange={(e) => set("metricKind", e.target.value as MetricKind)} className={inputClassName}>
          {Object.entries(METRIC_LABELS).map(([kind, label]) => (
            <option key={kind} value={kind}>
              {label}
            </option>
          ))}
        </select>
        {draft.metricKind !== "count" &&
          (draft.sourceKind === "items" ? (
            <select value={draft.metricField} onChange={(e) => set("metricField", e.target.value)} className={inputClassName}>
              <option value="">Escolha o campo...</option>
              {numericFields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          ) : (
            <select value={draft.metricField} onChange={(e) => set("metricField", e.target.value)} className={inputClassName}>
              <option value="">Escolha...</option>
              <option value="amount">Valor do lançamento</option>
            </select>
          ))}

        <select value={draft.visualization} onChange={(e) => set("visualization", e.target.value as Visualization)} className={inputClassName}>
          {Object.entries(VISUALIZATION_LABELS).map(([kind, label]) => (
            <option key={kind} value={kind}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Construtor de relatório personalizado (6.3, `/relatorios/novo`) — seções (fonte + agrupamento + métrica + visual) com prévia ao vivo, sem SQL livre. */
export function CustomReportBuilder({ types, spaces, categories }: { types: TypeWithFields[]; spaces: SidebarSpace[]; categories: CategoryRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("Novo relatório");
  const [period, setPeriod] = useState<RelativePeriod>("this_month");
  const [spaceId, setSpaceId] = useState("");
  const [sections, setSections] = useState<SectionDraft[]>([newSection()]);
  const [preview, setPreview] = useState<{ title: string; blocks: ReportBlock[] } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const config = { sections: sections.map(sectionDraftToConfig) };
      const invalid = sections.some((s) => (s.sourceKind === "items" && !s.typeId) || (s.groupByKind === "field" && !s.groupByField) || (s.metricKind !== "count" && !s.metricField));
      if (invalid) {
        setPreview(null);
        setPreviewError(null);
        return;
      }
      previewCustomReport({ period, spaceId: spaceId || null, config }).then((result) => {
        if (!result.ok) {
          setPreviewError(result.error);
          setPreview(null);
          return;
        }
        setPreviewError(null);
        setPreview(result.data);
      });
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sections, period, spaceId]);

  function updateSection(id: string, next: SectionDraft) {
    setSections((prev) => prev.map((s) => (s.id === id ? next : s)));
  }

  function removeSection(id: string) {
    setSections((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
  }

  function handleSave() {
    const config = { sections: sections.map(sectionDraftToConfig) };
    startSaving(async () => {
      const result = await saveCustomReportDefinition(null, {
        name,
        kind: "custom",
        params: { period, spaceId: spaceId || null, config },
        scheduleRrule: null,
        deliverTo: { me: true, contactIds: [] },
        channels: ["push"],
        includeAiSummary: false,
        enabled: true,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Relatório salvo.");
      router.push("/relatorios");
    });
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClassName} text-lg font-semibold`} />
        <button type="button" onClick={handleSave} disabled={isSaving} className="rounded-lg bg-black px-4 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black">
          {isSaving ? "Salvando..." : "Salvar relatório"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={period} onChange={(e) => setPeriod(e.target.value as RelativePeriod)} className={inputClassName}>
          {Object.entries(PERIOD_LABELS)
            .filter(([key]) => key !== "custom")
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
        {spaces.length > 0 && (
          <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className={inputClassName}>
            <option value="">Todos os espaços</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Seções</h2>
        {sections.map((section) => (
          <SectionEditor key={section.id} draft={section} types={types} categories={categories} onChange={(next) => updateSection(section.id, next)} onRemove={() => removeSection(section.id)} />
        ))}
        <button
          type="button"
          onClick={() => setSections((prev) => [...prev, newSection()])}
          className="flex items-center gap-1.5 self-start rounded-lg border border-dashed border-black/[.16] px-3 py-1.5 text-sm text-zinc-500 hover:border-black/30 dark:border-white/[.2] dark:text-zinc-400"
        >
          <Plus className="h-4 w-4" /> Seção
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-black/[.08] pt-4 dark:border-white/[.08]">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Prévia</h2>
        {previewError && <p className="text-sm text-red-600 dark:text-red-400">{previewError}</p>}
        {preview && <GenericReportView title={preview.title} subtitle="Prévia — dados atuais" blocks={preview.blocks} />}
        {!preview && !previewError && <p className="text-sm text-zinc-500 dark:text-zinc-400">Preencha as seções pra ver a prévia.</p>}
      </div>
    </div>
  );
}
