import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shiftMonth } from "@/features/financas/lib/period-range";
import type { Database } from "@/lib/supabase/database.types";
import { latestValueCents, netWorthSeries, type MonthValue, type NetWorthKind, type NetWorthMonthTotal } from "./lib/net-worth";

type Client = SupabaseClient<Database>;

const HISTORY_MONTHS = 12;

export interface NetWorthItemRow {
  id: string;
  kind: NetWorthKind;
  name: string;
  latestValueCents: number | null;
  snapshots: MonthValue[];
}

export interface NetWorthData {
  items: NetWorthItemRow[];
  series: NetWorthMonthTotal[];
  months: string[];
}

/** Painel de Patrimônio (10.12): itens (investimentos/dívidas) com o histórico de cada um e a série somada dos últimos 12 meses. */
export async function getNetWorthData(supabase: Client, ownerId: string, referenceMonth: string): Promise<NetWorthData> {
  const months = Array.from({ length: HISTORY_MONTHS }, (_, i) => shiftMonth(referenceMonth, i - (HISTORY_MONTHS - 1)));

  const { data: items } = await supabase
    .from("net_worth_items")
    .select("id, kind, name")
    .eq("owner_id", ownerId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  const itemIds = (items ?? []).map((item) => item.id);
  const { data: snapshots } =
    itemIds.length > 0
      ? await supabase.from("net_worth_snapshots").select("item_id, month, value_cents").eq("owner_id", ownerId).in("item_id", itemIds)
      : { data: [] as { item_id: string; month: string; value_cents: number }[] };

  const snapshotsByItem = new Map<string, MonthValue[]>();
  for (const row of snapshots ?? []) {
    const list = snapshotsByItem.get(row.item_id) ?? [];
    list.push({ month: row.month.slice(0, 7), valueCents: row.value_cents });
    snapshotsByItem.set(row.item_id, list);
  }

  const itemRows: NetWorthItemRow[] = (items ?? []).map((item) => {
    const itemSnapshots = snapshotsByItem.get(item.id) ?? [];
    return { id: item.id, kind: item.kind as NetWorthKind, name: item.name, latestValueCents: latestValueCents(itemSnapshots), snapshots: itemSnapshots };
  });

  const series = netWorthSeries(
    itemRows.map((item) => ({ kind: item.kind, snapshots: item.snapshots })),
    months,
  );

  return { items: itemRows, series, months };
}
