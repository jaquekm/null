import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AccountKind, PixKeyType } from "./schemas";

type Client = SupabaseClient<Database>;

export interface AccountRow {
  id: string;
  name: string;
  kind: AccountKind;
  institution: string | null;
  spaceId: string | null;
  openingBalanceCents: number;
  openingDate: string;
  creditLimitCents: number | null;
  closingDay: number | null;
  dueDay: number | null;
  paymentAccountId: string | null;
}

const ACCOUNT_COLUMNS =
  "id, name, kind, institution, space_id, opening_balance_cents, opening_date, credit_limit_cents, closing_day, due_day, payment_account_id";

function mapAccountRow(row: Record<string, unknown>): AccountRow {
  return {
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as AccountKind,
    institution: row.institution as string | null,
    spaceId: row.space_id as string | null,
    openingBalanceCents: row.opening_balance_cents as number,
    openingDate: row.opening_date as string,
    creditLimitCents: row.credit_limit_cents as number | null,
    closingDay: row.closing_day as number | null,
    dueDay: row.due_day as number | null,
    paymentAccountId: row.payment_account_id as string | null,
  };
}

/** Contas ainda ativas do dono (onboarding financeiro, 4.3). */
export async function listAccounts(supabase: Client): Promise<AccountRow[]> {
  const { data, error } = await supabase.from("fin_accounts").select(ACCOUNT_COLUMNS).is("archived_at", null).order("position", { ascending: true });
  if (error) throw error;
  return data.map(mapAccountRow);
}

export interface CategoryRow {
  id: string;
  parentId: string | null;
  name: string;
  kind: "income" | "expense";
}

/** Categorias ativas do dono, pra revisar no onboarding (4.3) e usar em regras/lançamentos depois. */
export async function listCategories(supabase: Client): Promise<CategoryRow[]> {
  const { data, error } = await supabase.from("fin_categories").select("id, parent_id, name, kind").is("archived_at", null).order("name", { ascending: true });
  if (error) throw error;
  return data.map((row) => ({ id: row.id, parentId: row.parent_id, name: row.name, kind: row.kind as "income" | "expense" }));
}

export interface PixKeyRow {
  id: string;
  label: string;
  keyType: PixKeyType;
  keyValue: string;
  merchantName: string;
  merchantCity: string;
  spaceId: string | null;
  isDefault: boolean;
}

/** Chaves Pix cadastradas (4.3 — opcional; usadas de verdade na página pública de cobrança, 4.10). */
export async function listPixKeys(supabase: Client): Promise<PixKeyRow[]> {
  const { data, error } = await supabase
    .from("fin_pix_keys")
    .select("id, label, key_type, key_value, merchant_name, merchant_city, space_id, is_default")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    label: row.label,
    keyType: row.key_type as PixKeyType,
    keyValue: row.key_value,
    merchantName: row.merchant_name,
    merchantCity: row.merchant_city,
    spaceId: row.space_id,
    isDefault: row.is_default,
  }));
}

/** "Enviar dados financeiros pra IA" (4.3, passo 4) — padrão desligado, só liga se o dono marcar explicitamente. */
export async function isFinanceAiEnabled(supabase: Client, ownerId: string): Promise<boolean> {
  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle();
  const preferences = (data?.preferences as Record<string, unknown> | null) ?? {};
  return preferences.financeAiEnabled === true;
}

/** Marca (ou não) que o onboarding financeiro já rodou — evita redirecionar pra `/financas/configurar` de novo. */
export async function isFinanceOnboardingCompleted(supabase: Client, ownerId: string): Promise<boolean> {
  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle();
  const preferences = (data?.preferences as Record<string, unknown> | null) ?? {};
  return Boolean(preferences.financeOnboardingCompletedAt);
}
