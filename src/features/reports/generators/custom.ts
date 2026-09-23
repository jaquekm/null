import "server-only";
import type { z } from "zod";
import { listCategories, listTransactions, type TransactionRow } from "@/features/financas/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import type { FieldDefinition } from "@/features/types/schemas";
import { queryViewItems, type ViewItemRow } from "@/features/views/queries";
import { formatBRL } from "@/lib/money";
import type { ReportBlock } from "../lib/blocks";
import { aggregateGroups, periodBucket, type AggregatedGroup, type GroupableRow, type MetricKind, type Visualization } from "../lib/custom-report";
import { baseReportParamsSchema, customReportConfigSchema, type CustomReportGroupBy, type CustomReportMetric, type CustomReportSection, type CustomReportSource } from "../schemas";
import type { Client, ReportContext, ReportGenerator } from "../types";

export const customReportParamsSchema = baseReportParamsSchema.extend({ config: customReportConfigSchema });
export type CustomReportParams = z.infer<typeof customReportParamsSchema>;

/** Como formatar o `value` agregado — decidido a partir do tipo do campo de métrica escolhido (`money` já vem em centavos de `items.properties`, igual `fin_transactions.amount_cents`; os demais numéricos formatam como número puro). */
export type MetricUnit = "count" | "money" | "number";

export interface CustomSectionResult {
  title: string;
  visualization: Visualization;
  metric: MetricKind;
  unit: MetricUnit;
  groups: AggregatedGroup[];
}

export interface CustomReportData {
  sections: CustomSectionResult[];
}

function metricKindOf(metric: CustomReportMetric): MetricKind {
  return metric.kind;
}

function numberProperty(properties: Record<string, unknown>, key: string): number | null {
  const raw = properties[key];
  return typeof raw === "number" ? raw : null;
}

interface RawGroupedValue {
  keys: string[];
  labels: Map<string, string>;
}

/** Resolve as chaves de agrupamento de UMA linha (item) pro `groupBy` escolhido — `multi_select`/`relation` múltiplo pode devolver mais de uma chave. Nomes de `contact`/`relation` ficam pendentes em `pendingContactIds`/`pendingItemIds` pra resolver em lote depois. */
function itemGroupKeys(
  row: ViewItemRow,
  groupBy: CustomReportGroupBy,
  fieldByKey: Map<string, FieldDefinition>,
  spaceNameById: Map<string, string>,
  pendingContactIds: Set<string>,
  pendingItemIds: Set<string>,
): RawGroupedValue {
  const labels = new Map<string, string>();

  if (groupBy.kind === "none") return { keys: ["_"], labels: new Map([["_", "Total"]]) };
  if (groupBy.kind === "space") {
    const key = row.spaceId ?? "_none";
    labels.set(key, row.spaceId ? (spaceNameById.get(row.spaceId) ?? "Espaço") : "Sem espaço");
    return { keys: [key], labels };
  }
  if (groupBy.kind === "tag") {
    if (row.tags.length === 0) return { keys: ["_none"], labels: new Map([["_none", "Sem tag"]]) };
    for (const tag of row.tags) labels.set(tag.id, tag.name);
    return { keys: row.tags.map((t) => t.id), labels };
  }
  if (groupBy.kind === "period") {
    const bucket = periodBucket(row.createdAt.slice(0, 10), groupBy.granularity);
    labels.set(bucket.key, bucket.label);
    return { keys: [bucket.key], labels };
  }
  if (groupBy.kind === "category") return { keys: ["_none"], labels: new Map([["_none", "—"]]) };

  const field = fieldByKey.get(groupBy.field);
  const raw = row.properties[groupBy.field];
  if (raw == null || raw === "") return { keys: ["_empty"], labels: new Map([["_empty", "Vazio"]]) };

  if (field?.type === "select") {
    const key = String(raw);
    labels.set(key, field.options?.find((o) => o.id === key)?.label ?? key);
    return { keys: [key], labels };
  }
  if (field?.type === "multi_select") {
    const values = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    for (const value of values) labels.set(value, field.options?.find((o) => o.id === value)?.label ?? value);
    return { keys: values, labels };
  }
  if (field?.type === "checkbox") {
    const key = raw === true ? "true" : "false";
    labels.set(key, raw === true ? "Sim" : "Não");
    return { keys: [key], labels };
  }
  if (field?.type === "contact") {
    const ids = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    for (const id of ids) pendingContactIds.add(id);
    return { keys: ids, labels };
  }
  if (field?.type === "relation") {
    const ids = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    for (const id of ids) pendingItemIds.add(id);
    return { keys: ids, labels };
  }

  const key = String(raw);
  labels.set(key, key);
  return { keys: [key], labels };
}

/** `money` fica em centavos (igual está guardado); os outros tipos numéricos (`number`/`percent`/`duration`/`rating`) formatam como número puro. */
function metricUnitOf(field: FieldDefinition | undefined): MetricUnit {
  return field?.type === "money" ? "money" : "number";
}

async function collectItemsSection(
  supabase: Client,
  ownerId: string,
  spaceId: string | null,
  source: Extract<CustomReportSource, { kind: "items" }>,
  groupBy: CustomReportGroupBy,
  metric: CustomReportMetric,
): Promise<{ rows: GroupableRow[]; unit: MetricUnit }> {
  const { data: type } = await supabase.from("object_types").select("id, fields").eq("id", source.typeId).eq("owner_id", ownerId).maybeSingle();
  const fields = ((type?.fields as unknown as FieldDefinition[] | null) ?? []) as FieldDefinition[];
  const fieldByKey = new Map(fields.map((f) => [f.key, f]));

  const result = await queryViewItems(supabase, { spaceId: spaceId ?? undefined, typeId: source.typeId, filters: source.filters, sort: [], fields, page: 1, pageSize: ROW_LIMIT });

  const spaces = await listActiveSpaces(supabase);
  const spaceNameById = new Map(spaces.map((s) => [s.id, s.name]));

  const pendingContactIds = new Set<string>();
  const pendingItemIds = new Set<string>();
  const perRow: { row: ViewItemRow; grouped: RawGroupedValue }[] = result.rows.map((row) => ({
    row,
    grouped: itemGroupKeys(row, groupBy, fieldByKey, spaceNameById, pendingContactIds, pendingItemIds),
  }));

  const [contactNames, itemTitles] = await Promise.all([loadContactNames(supabase, [...pendingContactIds]), loadItemTitles(supabase, [...pendingItemIds])]);

  const metricFieldKey = metric.kind === "count" ? null : metric.field;
  const unit = metric.kind === "count" ? "count" : metricUnitOf(metricFieldKey ? fieldByKey.get(metricFieldKey) : undefined);

  const rows: GroupableRow[] = [];
  for (const { row, grouped } of perRow) {
    const metricValue = metricFieldKey ? numberProperty(row.properties, metricFieldKey) : null;
    for (const key of grouped.keys) {
      const label = grouped.labels.get(key) ?? contactNames.get(key) ?? itemTitles.get(key) ?? key;
      rows.push({ sourceId: row.id, groupKey: key, groupLabel: label, metricValue });
    }
  }
  return { rows, unit };
}

/** Fonte "transactions" só suporta métrica sobre o valor do lançamento (`amount`, em centavos) — qualquer outro nome de campo em soma/média/mín/máx não encontra valor e fica de fora da agregação (mesmo comportamento seguro de um campo vazio). */
async function collectTransactionsSection(
  supabase: Client,
  ctx: ReportContext<CustomReportParams>,
  source: Extract<CustomReportSource, { kind: "transactions" }>,
  groupBy: CustomReportGroupBy,
  metric: CustomReportMetric,
): Promise<{ rows: GroupableRow[]; unit: MetricUnit }> {
  const transactions = await listTransactions(supabase, {
    periodStart: ctx.startDateKey,
    periodEnd: ctx.endDateKey,
    spaceId: ctx.params.spaceId ?? undefined,
    accountId: source.accountId,
    categoryId: source.categoryId,
    contactId: source.contactId,
    type: source.type,
  });
  const categories = groupBy.kind === "category" ? await listCategories(supabase) : [];
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  const metricFieldKey = metric.kind === "count" ? null : metric.field;
  const unit: MetricUnit = metric.kind === "count" ? "count" : "money";

  const rows: GroupableRow[] = transactions.map((t: TransactionRow): GroupableRow => {
    const { key, label } = transactionGroupKey(t, groupBy, categoryNameById);
    const metricValue = metricFieldKey === "amount" ? t.amountCents : null;
    return { sourceId: t.id, groupKey: key, groupLabel: label, metricValue };
  });
  return { rows, unit };
}

function transactionGroupKey(t: TransactionRow, groupBy: CustomReportGroupBy, categoryNameById: Map<string, string>): { key: string; label: string } {
  if (groupBy.kind === "category") return t.categoryId ? { key: t.categoryId, label: categoryNameById.get(t.categoryId) ?? "Categoria" } : { key: "_none", label: "Sem categoria" };
  if (groupBy.kind === "period") return periodBucket(t.occurredOn, groupBy.granularity);
  return { key: "_", label: "Total" };
}

const ROW_LIMIT = 500;
const MAX_GROUPS = 50;

/**
 * "Relatórios personalizados" (6.3) — sem SQL livre: cada seção escolhe uma
 * fonte (itens de um tipo, com o mesmo `ViewFilter`/`queryViewItems` da
 * 1.15; ou lançamentos financeiros, com os filtros que a 4.4 já suporta),
 * um agrupamento e uma métrica, executados em memória por `aggregateGroups`
 * (função pura, testada). Limite de `ROW_LIMIT` linhas buscadas e
 * `MAX_GROUPS` grupos exibidos por seção, como o enunciado pede.
 */
export const customReport: ReportGenerator<CustomReportParams, CustomReportData> = {
  kind: "custom",
  label: "Personalizado",
  paramsSchema: customReportParamsSchema,

  async collect(ctx: ReportContext<CustomReportParams>): Promise<CustomReportData> {
    const { supabase, ownerId, params } = ctx;

    const sections: CustomSectionResult[] = [];
    for (const section of params.config.sections as CustomReportSection[]) {
      const { rows, unit } =
        section.source.kind === "items"
          ? await collectItemsSection(supabase, ownerId, params.spaceId, section.source, section.groupBy, section.metric)
          : await collectTransactionsSection(supabase, ctx, section.source, section.groupBy, section.metric);

      const groups = aggregateGroups(rows, metricKindOf(section.metric)).slice(0, MAX_GROUPS);
      sections.push({ title: section.title, visualization: section.visualization, metric: metricKindOf(section.metric), unit, groups });
    }

    return { sections };
  },

  title(_params, startDateKey, endDateKey) {
    return `Relatório personalizado — ${startDateKey} a ${endDateKey}`;
  },

  toBlocks(data): ReportBlock[] {
    return data.sections.map((section): ReportBlock => sectionToBlock(section));
  },
};

function formatMetricValue(value: number, unit: MetricUnit): string {
  if (unit === "money") return formatBRL(Math.round(value));
  if (unit === "count") return String(Math.round(value));
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function sectionToBlock(section: CustomSectionResult): ReportBlock {
  if (section.groups.length === 0) return { kind: "text", title: section.title, body: "Nenhum dado encontrado pra essa seção." };

  if (section.visualization === "number") {
    const total = section.groups.reduce((sum, g) => sum + g.value, 0);
    return { kind: "cards", items: [{ label: section.title, value: formatMetricValue(total, section.unit) }] };
  }

  if (section.visualization === "bars") {
    const max = Math.max(...section.groups.map((g) => g.value), 1);
    return {
      kind: "bars",
      title: section.title,
      rows: section.groups.map((g) => ({ label: g.label, valueLabel: formatMetricValue(g.value, section.unit), percent: (g.value / max) * 100 })),
    };
  }

  // "line"/"donut" caem pra tabela nesta primeira versão (6.3) — ver docs/decisoes.md.
  return {
    kind: "table",
    title: section.title,
    columns: [
      { key: "label", label: "Grupo" },
      { key: "value", label: "Valor", align: "right" },
    ],
    rows: section.groups.map((g) => ({ label: g.label, value: formatMetricValue(g.value, section.unit) })),
  };
}

async function loadContactNames(supabase: Client, contactIds: string[]): Promise<Map<string, string>> {
  if (contactIds.length === 0) return new Map();
  const { data } = await supabase.from("contacts").select("id, name, nickname").in("id", contactIds);
  return new Map((data ?? []).map((row) => [row.id, row.nickname || row.name]));
}

async function loadItemTitles(supabase: Client, itemIds: string[]): Promise<Map<string, string>> {
  if (itemIds.length === 0) return new Map();
  const { data } = await supabase.from("items").select("id, title").in("id", itemIds);
  return new Map((data ?? []).map((row) => [row.id, row.title || "Sem título"]));
}
