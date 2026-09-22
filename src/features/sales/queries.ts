import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import type { Database } from "@/lib/supabase/database.types";
import { sumCents, type Cents } from "@/lib/money";
import { buildStageSegments, type StageSegment } from "./lib/stage-segments";
import { computeAverageDurationDays, computeConversionFunnel, type ConversionStep } from "./lib/stage-metrics";

type Client = SupabaseClient<Database>;

/** Ordem de progresso do funil do pack CRM (5.6, `packs/crm.json`) — "perdido" é desfecho, não um degrau a comparar com o seguinte. */
export const OPPORTUNITY_STAGE_ORDER = ["lead", "qualificado", "proposta_enviada", "negociacao", "ganho"] as const;

export interface SalesTypeIds {
  opportunityTypeId: string;
  proposalTypeId: string | null;
  activityTypeId: string | null;
}

/** Os tipos do pack CRM (5.6) não têm id fixo — são criados na instalação. `null` = pack não instalado ainda. */
export async function getSalesTypeIds(supabase: Client): Promise<SalesTypeIds | null> {
  const { data, error } = await supabase.from("object_types").select("id, slug").in("slug", ["oportunidade", "proposta", "atividade"]);
  if (error) throw error;

  const idBySlug = new Map((data ?? []).map((row) => [row.slug, row.id]));
  const opportunityTypeId = idBySlug.get("oportunidade");
  if (!opportunityTypeId) return null;

  return { opportunityTypeId, proposalTypeId: idBySlug.get("proposta") ?? null, activityTypeId: idBySlug.get("atividade") ?? null };
}

interface OpportunityRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  properties: Record<string, unknown>;
}

async function listOpportunities(supabase: Client, typeId: string): Promise<OpportunityRow[]> {
  const { data, error } = await supabase.from("items").select("id, created_at, updated_at, properties").eq("type_id", typeId).is("deleted_at", null);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    properties: (row.properties as Record<string, unknown> | null) ?? {},
  }));
}

async function buildSegmentsByItem(supabase: Client, opportunities: OpportunityRow[]): Promise<Record<string, StageSegment[]>> {
  if (opportunities.length === 0) return {};

  const { data: versions, error } = await supabase
    .from("item_versions")
    .select("item_id, properties, created_at")
    .in(
      "item_id",
      opportunities.map((o) => o.id),
    )
    .order("created_at", { ascending: true });
  if (error) throw error;

  const versionsByItem = new Map<string, { stage: string | null; until: string }[]>();
  for (const version of versions ?? []) {
    const properties = (version.properties as Record<string, unknown> | null) ?? {};
    const stage = typeof properties.stage === "string" ? properties.stage : null;
    const list = versionsByItem.get(version.item_id) ?? [];
    list.push({ stage, until: version.created_at });
    versionsByItem.set(version.item_id, list);
  }

  const result: Record<string, StageSegment[]> = {};
  for (const opportunity of opportunities) {
    const currentStage = typeof opportunity.properties.stage === "string" ? opportunity.properties.stage : null;
    result[opportunity.id] = buildStageSegments(opportunity.createdAt, versionsByItem.get(opportunity.id) ?? [], { stage: currentStage });
  }
  return result;
}

export interface LostReasonCount {
  reason: string;
  count: number;
}

export interface SalesDashboardData {
  openValueCents: Cents;
  openCount: number;
  weightedForecastCents: Cents;
  wonCount: number;
  wonValueCents: Cents;
  lostCount: number;
  lostByReason: LostReasonCount[];
  conversionFunnel: ConversionStep[];
  avgDurationDaysByStage: Record<string, number>;
}

function numberProperty(properties: Record<string, unknown>, key: string): number {
  const raw = properties[key];
  return typeof raw === "number" ? raw : 0;
}

function stringProperty(properties: Record<string, unknown>, key: string): string | null {
  const raw = properties[key];
  return typeof raw === "string" && raw ? raw : null;
}

/**
 * Painel `/vendas` (5.6, "código específico"): valor em aberto no funil,
 * previsão ponderada do mês, taxa de conversão e tempo médio por etapa (a
 * partir do histórico de versões de `stage`, `item_versions`), ganhos ×
 * perdidos por motivo. `timezone` decide o que é "o mês atual".
 */
export async function getSalesDashboardData(supabase: Client, opportunityTypeId: string, timezone: string): Promise<SalesDashboardData> {
  const opportunities = await listOpportunities(supabase, opportunityTypeId);
  const segmentsByItem = await buildSegmentsByItem(supabase, opportunities);
  const now = new Date();
  const currentMonth = formatInTimeZone(now, timezone, "yyyy-MM");

  const open = opportunities.filter((o) => {
    const stage = stringProperty(o.properties, "stage");
    return stage !== "ganho" && stage !== "perdido";
  });
  const won = opportunities.filter((o) => stringProperty(o.properties, "stage") === "ganho");
  const lost = opportunities.filter((o) => stringProperty(o.properties, "stage") === "perdido");

  const weightedForecastCents = sumCents(
    open
      .filter((o) => (stringProperty(o.properties, "expected_close") ?? "").startsWith(currentMonth))
      .map((o) => Math.round((numberProperty(o.properties, "value") * numberProperty(o.properties, "probability")) / 100)),
  );

  const lostReasonCounts = new Map<string, number>();
  for (const o of lost) {
    const reason = stringProperty(o.properties, "lost_reason") ?? "Sem motivo registrado";
    lostReasonCounts.set(reason, (lostReasonCounts.get(reason) ?? 0) + 1);
  }

  const allSegments = opportunities.map((o) => segmentsByItem[o.id] ?? []);

  return {
    openValueCents: sumCents(open.map((o) => numberProperty(o.properties, "value"))),
    openCount: open.length,
    weightedForecastCents,
    wonCount: won.length,
    wonValueCents: sumCents(won.map((o) => numberProperty(o.properties, "value"))),
    lostCount: lost.length,
    lostByReason: [...lostReasonCounts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    conversionFunnel: computeConversionFunnel(allSegments, [...OPPORTUNITY_STAGE_ORDER]),
    avgDurationDaysByStage: computeAverageDurationDays(allSegments, now),
  };
}

export interface ProposalExportData {
  title: string;
  status: string | null;
  valueCents: number;
  validUntil: string | null;
  content: unknown;
  opportunityTitle: string | null;
  contactName: string | null;
  companyName: string | null;
}

/** Dados pra exportar uma Proposta em HTML pra impressão (5.6, "gerar proposta... exportar HTML pra impressão"). */
export async function getProposalExportData(supabase: Client, ownerId: string, proposalItemId: string, opportunityTypeId: string): Promise<ProposalExportData | null> {
  const { data: proposal, error } = await supabase
    .from("items")
    .select("title, content, properties")
    .eq("id", proposalItemId)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!proposal) return null;

  const properties = (proposal.properties as Record<string, unknown> | null) ?? {};
  const opportunityIds = Array.isArray(properties.opportunity) ? properties.opportunity : [];
  const opportunityId = typeof opportunityIds[0] === "string" ? opportunityIds[0] : null;

  let opportunityTitle: string | null = null;
  let contactName: string | null = null;
  let companyName: string | null = null;

  if (opportunityId) {
    const { data: opportunity } = await supabase.from("items").select("title, properties").eq("id", opportunityId).eq("type_id", opportunityTypeId).maybeSingle();
    if (opportunity) {
      opportunityTitle = opportunity.title || null;
      const opportunityProperties = (opportunity.properties as Record<string, unknown> | null) ?? {};
      companyName = stringProperty(opportunityProperties, "company");
      const contactIds = Array.isArray(opportunityProperties.contact) ? opportunityProperties.contact : [];
      const contactId = typeof contactIds[0] === "string" ? contactIds[0] : null;
      if (contactId) {
        const { data: contact } = await supabase.from("contacts").select("name, nickname").eq("id", contactId).maybeSingle();
        contactName = contact ? contact.nickname || contact.name : null;
      }
    }
  }

  return {
    title: proposal.title || "Proposta sem título",
    status: stringProperty(properties, "status"),
    valueCents: numberProperty(properties, "value"),
    validUntil: stringProperty(properties, "valid_until"),
    content: proposal.content,
    opportunityTitle,
    contactName,
    companyName,
  };
}

export interface ContactOpportunityRow {
  id: string;
  title: string;
  stage: string | null;
  valueCents: number;
}

export interface ContactActivityRow {
  id: string;
  title: string;
  activityType: string | null;
  date: string | null;
}

export interface ContactSalesSummary {
  opportunities: ContactOpportunityRow[];
  activities: ContactActivityRow[];
}

/** Aba "Vendas" do contato (5.6) — oportunidades e atividades ligadas a ele pelo campo `contact`. */
export async function getContactSalesSummary(supabase: Client, contactId: string, typeIds: SalesTypeIds): Promise<ContactSalesSummary> {
  const [opportunitiesResult, activitiesResult] = await Promise.all([
    supabase.from("items").select("id, title, properties").eq("type_id", typeIds.opportunityTypeId).is("deleted_at", null),
    typeIds.activityTypeId
      ? supabase.from("items").select("id, title, properties").eq("type_id", typeIds.activityTypeId).is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (opportunitiesResult.error) throw opportunitiesResult.error;
  if (activitiesResult.error) throw activitiesResult.error;

  const opportunities = (opportunitiesResult.data ?? [])
    .filter((row) => {
      const properties = (row.properties as Record<string, unknown> | null) ?? {};
      return Array.isArray(properties.contact) && properties.contact.includes(contactId);
    })
    .map((row) => {
      const properties = (row.properties as Record<string, unknown> | null) ?? {};
      return { id: row.id, title: row.title || "Sem título", stage: stringProperty(properties, "stage"), valueCents: numberProperty(properties, "value") };
    });

  const activities = (activitiesResult.data ?? [])
    .filter((row) => {
      const properties = (row.properties as Record<string, unknown> | null) ?? {};
      return Array.isArray(properties.contact) && properties.contact.includes(contactId);
    })
    .map((row) => {
      const properties = (row.properties as Record<string, unknown> | null) ?? {};
      return { id: row.id, title: row.title || "Sem título", activityType: stringProperty(properties, "activity_type"), date: stringProperty(properties, "date") };
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return { opportunities, activities };
}
