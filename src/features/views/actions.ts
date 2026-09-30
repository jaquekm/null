"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emitItemEvent } from "@/features/automations/lib/emit-item-event";
import type { FieldDefinition } from "@/features/types/schemas";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import type { ColumnSummary } from "./lib/column-totals";
import { getUserTimezone } from "@/features/reminders/queries";
import { buildPropertiesSchema } from "@/features/types/schemas";
import { wallClockToIso } from "@/lib/dates";
import { buildXlsx } from "@/lib/xlsx/write";
import { buildExportSheet, exportableFields } from "./lib/sheet-export";
import { MAX_IMPORT_ROWS } from "./lib/sheet-import";
import { getTypeFields, listViewRowsForExport, queryViewItems, type ViewItemRow } from "./queries";
import { viewConfigSchema, viewKinds, type ViewConfig, type ViewFilter, type ViewKind, type ViewSort } from "./schemas";

const GENERIC_ERROR = "Não foi possível salvar a visão. Tente de novo.";

export interface GetViewItemsParams {
  spaceId?: string | null;
  typeId?: string | null;
  filters: ViewFilter[];
  sort: ViewSort[];
  page: number;
  pageSize?: number;
  /** Tabela (9.6): trazer a linha de totais. */
  withTotals?: boolean;
}

export interface GetViewItemsResult {
  fields: FieldDefinition[];
  rows: ViewItemRow[];
  total: number;
  totals?: Record<string, ColumnSummary>;
  totalsPartial?: boolean;
  /** Filtro que o banco recusou — a visão mostra o aviso em vez de derrubar a página inteira. */
  error?: string;
}

/**
 * Busca os dados de uma visão (1.15): campos do tipo (colunas/agrupamento) e
 * os itens já filtrados/ordenados/paginados no servidor. `ItemsView` chama
 * isso toda vez que filtro/ordenação/página muda.
 */
export async function getViewItems(params: GetViewItemsParams): Promise<GetViewItemsResult> {
  const { supabase } = await requireOwner();
  const fields = params.typeId ? await getTypeFields(supabase, params.typeId) : [];
  try {
    const { rows, total, totals, totalsPartial } = await queryViewItems(supabase, { ...params, fields });
    return { fields, rows, total, totals, totalsPartial };
  } catch {
    return { fields, rows: [], total: 0, error: "Não foi possível aplicar esses filtros. Revise ou remova o último filtro." };
  }
}

export interface CreatedView {
  id: string;
  name: string;
  kind: ViewKind;
}

const createViewSchema = z.object({
  spaceId: z.string().uuid(),
  typeId: z.string().uuid().nullable(),
  name: z.string().trim().min(1, "Dê um nome à visão.").max(80),
  kind: z.enum(viewKinds),
});

export async function createView(input: {
  spaceId: string;
  typeId: string | null;
  name: string;
  kind: ViewKind;
}): Promise<Result<CreatedView>> {
  const parsed = createViewSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const { supabase, user } = await requireOwner();

  let countQuery = supabase
    .from("views")
    .select("id", { count: "exact", head: true })
    .eq("space_id", parsed.data.spaceId);
  countQuery = parsed.data.typeId ? countQuery.eq("type_id", parsed.data.typeId) : countQuery.is("type_id", null);
  const { count } = await countQuery;

  const { data, error } = await supabase
    .from("views")
    .insert({
      owner_id: user.id,
      space_id: parsed.data.spaceId,
      type_id: parsed.data.typeId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      config: {} as unknown as Json,
      position: count ?? 0,
    })
    .select("id, name, kind")
    .single();
  if (error || !data) return fail(GENERIC_ERROR);

  // Rota do espaço é dinâmica (`/espacos/[slug]`) e essa action não tem o slug —
  // revalida o layout inteiro, mesmo padrão usado em `features/spaces/actions.ts`.
  revalidatePath("/", "layout");
  return ok({ id: data.id, name: data.name, kind: data.kind as ViewKind });
}

export async function renameView(viewId: string, name: string): Promise<Result<null>> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Dê um nome à visão.");

  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("views").update({ name: trimmed }).eq("id", viewId).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/", "layout");
  return ok(null);
}

export async function duplicateView(viewId: string): Promise<Result<CreatedView>> {
  const { supabase, user } = await requireOwner();

  const { data: original, error: readError } = await supabase
    .from("views")
    .select("space_id, type_id, name, kind, config, position")
    .eq("id", viewId)
    .maybeSingle();
  if (readError || !original) return fail("Visão não encontrada.");

  const { data, error } = await supabase
    .from("views")
    .insert({
      owner_id: user.id,
      space_id: original.space_id,
      type_id: original.type_id,
      name: `${original.name} (cópia)`,
      kind: original.kind,
      config: original.config,
      position: original.position + 1,
    })
    .select("id, name, kind")
    .single();
  if (error || !data) return fail("Não foi possível duplicar a visão.");

  revalidatePath("/", "layout");
  return ok({ id: data.id, name: data.name, kind: data.kind as ViewKind });
}

export async function deleteView(viewId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("views").delete().eq("id", viewId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível excluir a visão.");
  revalidatePath("/", "layout");
  return ok(null);
}

/** Marca como padrão do espaço/tipo (1.15) — desmarca as outras do mesmo contexto antes. */
export async function setDefaultView(viewId: string, spaceId: string, typeId: string | null): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  let unsetQuery = supabase.from("views").update({ is_default: false }).eq("space_id", spaceId).eq("owner_id", user.id);
  unsetQuery = typeId ? unsetQuery.eq("type_id", typeId) : unsetQuery.is("type_id", null);
  const { error: unsetError } = await unsetQuery;
  if (unsetError) return fail(GENERIC_ERROR);

  const { error } = await supabase.from("views").update({ is_default: true }).eq("id", viewId).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/", "layout");
  return ok(null);
}

export interface CreatedKanbanItem {
  id: string;
  title: string;
  properties: Record<string, unknown>;
  updatedAt: string;
  createdAt: string;
  position: number;
}

const createInColumnSchema = z.object({
  spaceId: z.string().uuid(),
  typeId: z.string().uuid(),
  title: z.string().trim().min(1, "Dê um título ao card."),
  groupField: z.string(),
  groupValue: z.string().nullable(),
});

/** "Adicionar card direto na coluna" do Kanban (1.15) — já cria com a propriedade de agrupamento preenchida. */
export async function createItemInColumn(input: {
  spaceId: string;
  typeId: string;
  title: string;
  groupField: string;
  groupValue: string | null;
}): Promise<Result<CreatedKanbanItem>> {
  const parsed = createInColumnSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Não foi possível criar o item.");

  const { supabase, user } = await requireOwner();
  const properties = parsed.data.groupValue ? { [parsed.data.groupField]: parsed.data.groupValue } : {};

  const { data, error } = await supabase
    .from("items")
    .insert({
      owner_id: user.id,
      space_id: parsed.data.spaceId,
      type_id: parsed.data.typeId,
      title: parsed.data.title,
      status: "active",
      properties: properties as unknown as Json,
    })
    .select("id, title, properties, updated_at, created_at, position")
    .single();
  if (error || !data) return fail("Não foi possível criar o item.");

  const createdProperties = (data.properties as Record<string, unknown> | null) ?? {};
  await emitItemEvent({ ownerId: user.id, itemId: data.id, before: null, after: { status: "active", properties: createdProperties } });

  return ok({
    id: data.id,
    title: data.title,
    properties: createdProperties,
    updatedAt: data.updated_at,
    createdAt: data.created_at,
    position: data.position,
  });
}

/** Salva filtros/ordenação/agrupamento/colunas visíveis da visão (1.15). */
export async function updateViewConfig(viewId: string, config: ViewConfig): Promise<Result<null>> {
  const parsed = viewConfigSchema.safeParse(config);
  if (!parsed.success) return fail(GENERIC_ERROR);

  const { supabase, user } = await requireOwner();
  const { error } = await supabase
    .from("views")
    .update({ config: parsed.data as unknown as Json })
    .eq("id", viewId)
    .eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  return ok(null);
}

const exportSchema = z.object({
  spaceId: z.string().uuid().nullable().optional(),
  typeId: z.string().uuid().nullable().optional(),
  filters: z.array(z.object({ field: z.string(), op: z.string(), value: z.unknown().optional() })).max(50),
  sort: z.array(z.object({ field: z.string(), dir: z.enum(["asc", "desc"]) })).max(10),
  visibleFields: z.array(z.string()).max(200).optional(),
  name: z.string().trim().max(120),
});

/**
 * "Baixar Excel" da Tabela (9.6): o mesmo filtro e ordem da tela, até
 * `EXPORT_ROW_LIMIT` linhas, com título + colunas visíveis. Volta o arquivo
 * em base64 pro navegador salvar (é pequeno — só título e propriedades).
 */
export async function exportViewSpreadsheet(input: z.input<typeof exportSchema>): Promise<Result<{ base64: string; fileName: string; truncated: boolean }>> {
  const parsed = exportSchema.safeParse(input);
  if (!parsed.success) return fail("Não foi possível exportar esta visão.");

  const { supabase, user } = await requireOwner();
  const fields = parsed.data.typeId ? await getTypeFields(supabase, parsed.data.typeId) : [];
  try {
    const { rows, truncated } = await listViewRowsForExport(supabase, {
      spaceId: parsed.data.spaceId ?? null,
      typeId: parsed.data.typeId ?? null,
      filters: parsed.data.filters as ViewFilter[],
      sort: parsed.data.sort,
      fields,
    });
    const timezone = await getUserTimezone(supabase, user.id);
    const columns = exportableFields(fields, parsed.data.visibleFields);
    const bytes = await buildXlsx(buildExportSheet(parsed.data.name || "Planilha", rows, columns, timezone));
    const base = (parsed.data.name || "planilha").replace(/[\\/:*?"<>|]+/g, " ").trim() || "planilha";
    return ok({ base64: Buffer.from(bytes).toString("base64"), fileName: `${base}.xlsx`, truncated });
  } catch {
    return fail("Não foi possível exportar esta visão. Tente de novo.");
  }
}

const importSchema = z.object({
  spaceId: z.string().uuid(),
  typeId: z.string().uuid(),
  rows: z
    .array(z.object({ title: z.string().trim().min(1).max(500), properties: z.record(z.string(), z.unknown()) }))
    .min(1, "A planilha não tem linhas pra importar.")
    .max(MAX_IMPORT_ROWS, `No máximo ${MAX_IMPORT_ROWS} linhas por vez.`),
});

/**
 * "Importar planilha" na Tabela (9.6): cria um item por linha, no espaço e
 * tipo da visão. O navegador já leu o arquivo e casou as colunas
 * (`planSheetImport`); aqui cada valor é validado de novo pelo schema do
 * campo — o que não passar fica de fora (a linha entra do mesmo jeito).
 */
export async function importSpreadsheetRows(input: z.input<typeof importSchema>): Promise<Result<{ created: number; droppedValues: number }>> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Planilha inválida.");

  const { supabase, user } = await requireOwner();
  const fields = await getTypeFields(supabase, parsed.data.typeId);
  if (fields.length === 0) return fail("Tipo não encontrado.");
  const timezone = await getUserTimezone(supabase, user.id);
  const schemaByKey = new Map(fields.filter((field) => field.type !== "rollup" && field.type !== "formula").map((field) => [field.key, buildPropertiesSchema([{ ...field, required: false }])]));
  const datetimeKeys = new Set(fields.filter((field) => field.type === "datetime").map((field) => field.key));

  let droppedValues = 0;
  const records = parsed.data.rows.map((row) => {
    const properties: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(row.properties)) {
      const schema = schemaByKey.get(key);
      if (!schema) {
        droppedValues += 1;
        continue;
      }
      const value = datetimeKeys.has(key) && typeof raw === "string" ? wallClockToIso(raw, timezone) : raw;
      const check = schema.safeParse({ [key]: value });
      if (check.success) properties[key] = value;
      else droppedValues += 1;
    }
    return {
      owner_id: user.id,
      space_id: parsed.data.spaceId,
      type_id: parsed.data.typeId,
      title: row.title,
      status: "active",
      properties: properties as unknown as Json,
    };
  });

  let created = 0;
  for (let i = 0; i < records.length; i += 500) {
    const { error } = await supabase.from("items").insert(records.slice(i, i + 500));
    if (error) {
      if (created > 0) revalidatePath("/espacos");
      return fail(created > 0 ? `Importei ${created} linhas, mas o resto falhou. Tente de novo com o que faltou.` : "Não foi possível importar a planilha.");
    }
    created += Math.min(500, records.length - i);
  }
  revalidatePath("/espacos");
  return ok({ created, droppedValues });
}
