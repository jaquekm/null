import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { missingModules, packSchema, type Pack } from "./schemas";

type Client = SupabaseClient<Database>;

const PACKS_DIR = path.join(process.cwd(), "packs");

export interface LocalPackEntry {
  file: string;
  pack: Pack | null;
  error: string | null;
}

/** Lê e valida os packs em `packs/*.json` (5.2) — usado pela galeria em `/configuracoes/metodos`. */
export async function listLocalPacks(): Promise<LocalPackEntry[]> {
  let files: string[];
  try {
    files = (await readdir(PACKS_DIR)).filter((file) => file.endsWith(".json"));
  } catch {
    return [];
  }

  const entries: LocalPackEntry[] = [];
  for (const file of files.sort()) {
    try {
      const raw = await readFile(path.join(PACKS_DIR, file), "utf-8");
      const parsed = packSchema.safeParse(JSON.parse(raw));
      entries.push(parsed.success ? { file, pack: parsed.data, error: null } : { file, pack: null, error: parsed.error.issues[0]?.message ?? "Pack inválido." });
    } catch {
      entries.push({ file, pack: null, error: "Não foi possível ler o arquivo." });
    }
  }
  return entries;
}

export interface InstalledPackRow {
  id: string;
  packKey: string;
  version: string;
  spaceId: string | null;
  spaceName: string | null;
  installedAt: string;
}

export async function listInstalledPacks(supabase: Client, userId: string): Promise<InstalledPackRow[]> {
  const { data, error } = await supabase
    .from("packs_installed")
    .select("id, pack_key, version, space_id, installed_at, spaces(name)")
    .eq("owner_id", userId)
    .order("installed_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    packKey: row.pack_key,
    version: row.version,
    spaceId: row.space_id,
    spaceName: row.spaces?.name ?? null,
    installedAt: row.installed_at,
  }));
}

/** Módulos de `requires` que estão desligados e bloqueariam a instalação — só pra exibir aviso antes de tentar instalar. */
export async function checkPackRequirements(supabase: Client, userId: string, requires: string[]): Promise<string[]> {
  if (requires.length === 0) return [];
  const { data } = await supabase.from("user_settings").select("modules").eq("owner_id", userId).maybeSingle();
  const modules = (data?.modules as Record<string, unknown> | null) ?? {};
  return missingModules(requires, modules);
}

export interface ExportableType {
  id: string;
  name: string;
  icon: string | null;
}

export async function listExportableTypes(supabase: Client, userId: string): Promise<ExportableType[]> {
  const { data, error } = await supabase
    .from("object_types")
    .select("id, name, icon")
    .eq("owner_id", userId)
    .is("archived_at", null)
    .order("position", { ascending: true });
  if (error || !data) return [];
  return data;
}

export interface ExportableView {
  id: string;
  name: string;
  kind: string;
  typeId: string | null;
}

export async function listExportableViews(supabase: Client, userId: string): Promise<ExportableView[]> {
  const { data, error } = await supabase.from("views").select("id, name, kind, type_id").eq("owner_id", userId).order("position", { ascending: true });
  if (error || !data) return [];
  return data.map((view) => ({ id: view.id, name: view.name, kind: view.kind, typeId: view.type_id }));
}

export interface ExportableAutomation {
  id: string;
  name: string;
  typeId: string | null;
}

export async function listExportableAutomations(supabase: Client, userId: string): Promise<ExportableAutomation[]> {
  const { data, error } = await supabase.from("automations").select("id, name, type_id").eq("owner_id", userId).order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((automation) => ({ id: automation.id, name: automation.name, typeId: automation.type_id }));
}
