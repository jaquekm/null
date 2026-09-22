import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { FieldDefinition } from "@/features/types/schemas";
import type { ViewFilter } from "@/features/views/schemas";
import type { AutomationAction, AutomationTrigger } from "./schemas";

type Client = SupabaseClient<Database>;

export interface AutomationListRow {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerType: string;
  typeName: string | null;
  spaceName: string | null;
  lastRunAt: string | null;
  runCount: number;
  packKey: string | null;
}

/** Lista pra `/configuracoes/automacoes`: ativar/desativar, última execução e contagem (5.3). */
export async function listAutomations(supabase: Client, ownerId: string): Promise<AutomationListRow[]> {
  const { data, error } = await supabase
    .from("automations")
    .select("id, name, description, enabled, trigger, last_run_at, run_count, pack_key, object_types(name), spaces(name)")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    triggerType: ((row.trigger as { type?: string } | null)?.type as string | undefined) ?? "?",
    typeName: row.object_types?.name ?? null,
    spaceName: row.spaces?.name ?? null,
    lastRunAt: row.last_run_at,
    runCount: row.run_count,
    packKey: row.pack_key,
  }));
}

export interface AutomationDetail {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  spaceId: string | null;
  typeId: string | null;
  trigger: AutomationTrigger;
  conditions: ViewFilter[];
  actions: AutomationAction[];
  lastRunAt: string | null;
  runCount: number;
}

export async function getAutomation(supabase: Client, ownerId: string, id: string): Promise<AutomationDetail | null> {
  const { data, error } = await supabase
    .from("automations")
    .select("id, name, description, enabled, space_id, type_id, trigger, conditions, actions, last_run_at, run_count")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    enabled: data.enabled,
    spaceId: data.space_id,
    typeId: data.type_id,
    trigger: data.trigger as unknown as AutomationTrigger,
    conditions: (data.conditions as unknown as ViewFilter[] | null) ?? [],
    actions: (data.actions as unknown as AutomationAction[] | null) ?? [],
    lastRunAt: data.last_run_at,
    runCount: data.run_count,
  };
}

export interface TypeWithFields {
  id: string;
  name: string;
  fields: FieldDefinition[];
}

/** Pra popular o seletor "Aplica-se ao tipo" e os campos disponíveis no editor de condições/ações (5.3). */
export async function listTypesWithFields(supabase: Client, ownerId: string): Promise<TypeWithFields[]> {
  const { data, error } = await supabase
    .from("object_types")
    .select("id, name, fields")
    .eq("owner_id", ownerId)
    .is("archived_at", null)
    .order("position", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({ id: row.id, name: row.name, fields: (row.fields as unknown as FieldDefinition[] | null) ?? [] }));
}

export interface AutomationRunRow {
  id: string;
  itemId: string | null;
  itemTitle: string | null;
  status: string;
  detail: unknown;
  createdAt: string;
}

/** Histórico de execuções (5.3: "histórico de execuções com detalhes de falha"). */
export async function listAutomationRuns(supabase: Client, automationId: string, limit = 30): Promise<AutomationRunRow[]> {
  const { data, error } = await supabase
    .from("automation_runs")
    .select("id, item_id, status, detail, created_at, items(title)")
    .eq("automation_id", automationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemTitle: row.items?.title ?? null,
    status: row.status,
    detail: row.detail,
    createdAt: row.created_at,
  }));
}
