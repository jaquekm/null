import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { EXPIRY_PROPERTY, EXPIRY_WINDOW_DAYS, addDaysIso, expiryOf, suggestExpiryFromText } from "./lib/expiry";

type Client = SupabaseClient<Database>;

/** Validade lida no texto dos anexos do item (OCR), do mais novo pro mais velho — só sugestão (9.5). */
export async function suggestExpiryForItem(supabase: Client, itemId: string): Promise<string | null> {
  const { data } = await supabase
    .from("attachments")
    .select("extracted_text")
    .eq("item_id", itemId)
    .not("extracted_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);
  for (const row of data ?? []) {
    const suggestion = suggestExpiryFromText(row.extracted_text);
    if (suggestion) return suggestion;
  }
  return null;
}

export interface ExpiringItem {
  id: string;
  title: string;
  expiry: string;
}

/** Itens com validade entre 30 dias atrás e 30 dias à frente (cartão "Vencendo" do Hoje), do mais urgente pro menos. */
export async function listExpiringItems(supabase: Client, today: string): Promise<ExpiringItem[]> {
  const path = `properties->>${EXPIRY_PROPERTY}`;
  const { data } = await supabase
    .from("items")
    .select("id, title, properties")
    .is("deleted_at", null)
    .neq("status", "archived")
    .gte(path, addDaysIso(today, -EXPIRY_WINDOW_DAYS))
    .lte(path, addDaysIso(today, EXPIRY_WINDOW_DAYS))
    .limit(50);
  return (data ?? [])
    .map((row) => ({ id: row.id, title: row.title || "Sem título", expiry: expiryOf(row.properties as Record<string, unknown> | null) }))
    .filter((row): row is ExpiringItem => row.expiry !== null)
    .sort((a, b) => a.expiry.localeCompare(b.expiry));
}
