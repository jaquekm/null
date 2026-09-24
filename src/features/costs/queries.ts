import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { HubCostCategory } from "./schemas";

type Client = SupabaseClient<Database>;

export interface SubscriptionRow {
  id: string;
  name: string;
  monthlyCostCents: number;
  canceledAt: string | null;
  replacedInPhase: string | null;
  notes: string | null;
}

export async function listSubscriptions(supabase: Client): Promise<SubscriptionRow[]> {
  const { data, error } = await supabase
    .from("subscriptions_tracker")
    .select("id, name, monthly_cost_cents, canceled_at, replaced_in_phase, notes")
    .order("created_at", { ascending: true });
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    monthlyCostCents: row.monthly_cost_cents,
    canceledAt: row.canceled_at,
    replacedInPhase: row.replaced_in_phase,
    notes: row.notes,
  }));
}

export interface HubCostRow {
  id: string;
  referenceMonth: string;
  category: HubCostCategory;
  amountCents: number;
  notes: string | null;
}

export async function listHubCostsSince(supabase: Client, sinceMonth: string): Promise<HubCostRow[]> {
  const { data, error } = await supabase
    .from("hub_costs")
    .select("id, reference_month, category, amount_cents, notes")
    .gte("reference_month", sinceMonth)
    .order("reference_month", { ascending: true });
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    referenceMonth: row.reference_month,
    category: row.category as HubCostCategory,
    amountCents: row.amount_cents,
    notes: row.notes,
  }));
}
