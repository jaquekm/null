import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { daysUntilEmpty, dosesPerDay, isLowStock } from "./lib/medication-stock";

type Client = SupabaseClient<Database>;

export interface MedicationForToday {
  id: string;
  title: string;
  dose: string | null;
  horarios: string[];
  stock: number | null;
  daysLeft: number | null;
  lowStock: boolean;
}

/** Remédios do Hoje (10.5): itens ativos do tipo Remédio (pack "Saúde"), de qualquer espaço. */
export async function listMedications(supabase: Client): Promise<MedicationForToday[]> {
  const { data: types } = await supabase.from("object_types").select("id").eq("slug", "remedio").is("archived_at", null);
  const typeIds = (types ?? []).map((t) => t.id);
  if (typeIds.length === 0) return [];

  const { data: items } = await supabase
    .from("items")
    .select("id, title, properties")
    .in("type_id", typeIds)
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("title", { ascending: true });

  return (items ?? []).map((row) => {
    const properties = (row.properties as Record<string, unknown> | null) ?? {};
    const horarios = Array.isArray(properties.horarios) ? properties.horarios.filter((h): h is string => typeof h === "string") : [];
    const stock = typeof properties.stock === "number" ? properties.stock : null;
    const daysLeft = stock == null ? null : daysUntilEmpty(stock, dosesPerDay(horarios));
    return {
      id: row.id,
      title: row.title || "Sem título",
      dose: typeof properties.dose === "string" ? properties.dose : null,
      horarios,
      stock,
      daysLeft,
      lowStock: daysLeft != null && isLowStock(daysLeft),
    };
  });
}
