import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { expiryOf } from "@/features/documents/lib/expiry";
import { mostRecent, nextUpcoming, splitByToday, type DatedRecord } from "./lib/medical-summary";

type Client = SupabaseClient<Database>;

const SLUGS = ["consulta", "exame", "receita", "sintoma"] as const;
type MedicalSlug = (typeof SLUGS)[number];

interface MedicalTypeInfo {
  idsBySlug: Record<MedicalSlug, string[]>;
  /** Espaço onde o pack "Saúde — registros médicos" (10.7) foi instalado — todos os 4 tipos ficam no mesmo espaço, de uma instalação só. */
  space: { slug: string; name: string } | null;
}

async function getMedicalTypeInfo(supabase: Client, ownerId: string): Promise<MedicalTypeInfo> {
  const { data } = await supabase
    .from("object_types")
    .select("id, slug, space_id, spaces(slug, name)")
    .eq("owner_id", ownerId)
    .in("slug", SLUGS)
    .is("archived_at", null);

  const idsBySlug: Record<MedicalSlug, string[]> = { consulta: [], exame: [], receita: [], sintoma: [] };
  let space: { slug: string; name: string } | null = null;
  for (const row of data ?? []) {
    idsBySlug[row.slug as MedicalSlug]?.push(row.id);
    if (!space && row.spaces) space = { slug: row.spaces.slug, name: row.spaces.name };
  }
  return { idsBySlug, space };
}

async function listByTypeIds(supabase: Client, typeIds: string[], dateKey: string, titleKeys: string[]): Promise<DatedRecord[]> {
  if (typeIds.length === 0) return [];
  const { data } = await supabase.from("items").select("id, title, properties").in("type_id", typeIds).is("deleted_at", null).neq("status", "archived");
  return (data ?? []).flatMap((row) => {
    const properties = (row.properties as Record<string, unknown> | null) ?? {};
    const date = properties[dateKey];
    if (typeof date !== "string") return [];
    const detail = titleKeys.map((key) => properties[key]).find((v): v is string => typeof v === "string" && v.length > 0);
    return [{ id: row.id, title: row.title || detail || "Sem título", date }];
  });
}

export interface MedicalSummary {
  hasAny: boolean;
  space: { slug: string; name: string } | null;
  nextConsulta: DatedRecord | null;
}

/** Card "Saúde" do Hoje (10.7) — só aparece se o pack "Saúde — registros médicos" estiver instalado (algum dos 4 tipos existir). */
export async function getMedicalSummaryForToday(supabase: Client, ownerId: string, today: string): Promise<MedicalSummary> {
  const { idsBySlug, space } = await getMedicalTypeInfo(supabase, ownerId);
  const hasAny = SLUGS.some((slug) => idsBySlug[slug].length > 0);
  if (!hasAny) return { hasAny: false, space: null, nextConsulta: null };

  const consultas = await listByTypeIds(supabase, idsBySlug.consulta, "data", ["especialidade", "medico"]);
  return { hasAny, space, nextConsulta: nextUpcoming(consultas, today) };
}

export interface MedicalResumoData {
  consultasProximas: DatedRecord[];
  consultasPassadas: DatedRecord[];
  exames: DatedRecord[];
  receitas: (DatedRecord & { validade: string | null })[];
  sintomas: DatedRecord[];
}

/** "Resumo pra levar ao médico" (10.7): consultas (futuras e as últimas passadas), exames e sintomas recentes, receitas com validade. */
export async function getMedicalResumoData(supabase: Client, ownerId: string, today: string): Promise<MedicalResumoData> {
  const { idsBySlug } = await getMedicalTypeInfo(supabase, ownerId);

  const consultas = await listByTypeIds(supabase, idsBySlug.consulta, "data", ["especialidade", "medico"]);
  const { upcoming: consultasProximas, past } = splitByToday(consultas, today);

  const exames = mostRecent(await listByTypeIds(supabase, idsBySlug.exame, "data", ["tipo"]), 15);
  const sintomas = mostRecent(await listByTypeIds(supabase, idsBySlug.sintoma, "data", ["sintoma"]), 30);

  const receitaRows = idsBySlug.receita.length
    ? (await supabase.from("items").select("id, title, properties").in("type_id", idsBySlug.receita).is("deleted_at", null).neq("status", "archived")).data ?? []
    : [];
  const receitasAll = receitaRows.flatMap((row) => {
    const properties = (row.properties as Record<string, unknown> | null) ?? {};
    const date = properties.data;
    if (typeof date !== "string") return [];
    const medico = typeof properties.medico === "string" ? properties.medico : null;
    return [{ id: row.id, title: row.title || medico || "Receita", date, validade: expiryOf(properties) }];
  });

  return { consultasProximas, consultasPassadas: mostRecent(past, 10), exames, receitas: mostRecent(receitasAll, 15), sintomas };
}
