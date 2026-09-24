import "server-only";
import { z } from "zod";
import { buildAskContext, selectChunksWithinBudget } from "@/features/ai/lib/ask-context";
import { chunkProperties, type PropertyResolutionMaps } from "@/features/ai/lib/chunking";
import { periodBoundsUtc } from "@/features/ai/lib/period-filter";
import { fetchItemLabels, retrieveChunks } from "@/features/ai/lib/retrieve";
import { buildGoogleEventEntries } from "@/features/agenda/lib/build-google-event-entries";
import { buildReminderEntries } from "@/features/agenda/lib/build-reminder-entries";
import { extractItemDateEntries } from "@/features/agenda/lib/extract-item-date-entries";
import {
  listCalendarColors,
  listDateFieldsByTypeId,
  listGoogleEventsInRange,
  listItemsForDateExtraction,
  listRemindersInRange,
} from "@/features/agenda/queries";
import { getContactActivity, getContactById, listContacts } from "@/features/contacts/queries";
import { computeTransactionTotals } from "@/features/financas/lib/transaction-totals";
import { listCategories, listTransactions } from "@/features/financas/queries";
import { listBacklinks, getItemDetail } from "@/features/items/queries";
import { tiptapDocToMarkdown } from "@/features/items/lib/tiptap-to-markdown";
import { isFinanceContactsIndexingEnabled } from "@/features/settings/queries";
import type { FieldDefinition } from "@/features/types/schemas";
import { formatBRL } from "@/lib/money";
import type {
  askKnowledgeBaseInput,
  financeSummaryInput,
  getContactInput,
  getItemInput,
  listEventsInput,
  listItemsInput,
  listTasksInput,
  listTransactionsInput,
  searchInput,
} from "../schemas";
import type { AdminClient, McpContext } from "../types";

type Infer<T extends z.ZodRawShape> = z.infer<z.ZodObject<T>>;

/** Resolve um tipo por slug OU nome (case-insensitive) — mesmo padrão de `buildListItemsTool` (6.7). */
async function resolveType(admin: AdminClient, ownerId: string, nameOrSlug: string) {
  const bySlug = await admin.from("object_types").select("id, name, slug, fields").eq("owner_id", ownerId).ilike("slug", nameOrSlug).maybeSingle();
  if (bySlug.data) return bySlug.data;
  const byName = await admin.from("object_types").select("id, name, slug, fields").eq("owner_id", ownerId).ilike("name", nameOrSlug).maybeSingle();
  return byName.data ?? null;
}

async function resolveSpace(admin: AdminClient, ownerId: string, slug: string) {
  const { data } = await admin.from("spaces").select("id, name, slug").eq("owner_id", ownerId).eq("slug", slug).maybeSingle();
  return data;
}

/** "Respeitar ai_enabled dos espaços" (6.9) — mesmo critério do job `index_item` (6.5). */
async function listDisabledSpaceIds(admin: AdminClient, ownerId: string): Promise<Set<string>> {
  const { data } = await admin.from("spaces").select("id").eq("owner_id", ownerId).eq("ai_enabled", false);
  return new Set((data ?? []).map((row) => row.id));
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
}

/** `search` (mcp:read) — busca textual (`search_items`, 1.1), filtrada em memória por `spaces`/`types` quando informados. */
export async function mcpSearch(ctx: McpContext, input: Infer<typeof searchInput>): Promise<SearchResult[]> {
  const { admin, ownerId } = ctx;
  const disabledSpaceIds = await listDisabledSpaceIds(admin, ownerId);

  const [spaceIds, typeIds] = await Promise.all([
    input.spaces && input.spaces.length > 0 ? Promise.all(input.spaces.map((slug) => resolveSpace(admin, ownerId, slug))) : Promise.resolve(null),
    input.types && input.types.length > 0 ? Promise.all(input.types.map((slug) => resolveType(admin, ownerId, slug))) : Promise.resolve(null),
  ]);
  const allowedSpaceIds = spaceIds ? new Set(spaceIds.filter((s): s is NonNullable<typeof s> => s != null).map((s) => s.id)) : null;
  const allowedTypeIds = typeIds ? new Set(typeIds.filter((t): t is NonNullable<typeof t> => t != null).map((t) => t.id)) : null;

  const { data, error } = await admin.rpc("search_items", { q: input.query, p_limit: 100 });
  if (error || !data) return [];

  return data
    .filter((row) => !row.space_id || !disabledSpaceIds.has(row.space_id))
    .filter((row) => !allowedSpaceIds || (row.space_id != null && allowedSpaceIds.has(row.space_id)))
    .filter((row) => !allowedTypeIds || (row.type_id != null && allowedTypeIds.has(row.type_id)))
    .slice(0, input.limit)
    .map((row) => ({ id: row.id, title: row.title, snippet: row.snippet, url: `/itens/${row.id}` }));
}

export interface GetItemResult {
  id: string;
  title: string;
  type: string | null;
  space: string | null;
  properties: string;
  contentMarkdown: string;
  backlinks: { id: string; title: string }[];
  attachments: string[];
  transcriptSummary: string | null;
}

async function resolvePropertyMapsForItem(admin: AdminClient, ownerId: string, fields: FieldDefinition[], properties: Record<string, unknown>): Promise<PropertyResolutionMaps> {
  const contactIds = new Set<string>();
  const itemIds = new Set<string>();
  for (const field of fields) {
    const raw = properties[field.key];
    if (raw == null) continue;
    const ids = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    if (field.type === "contact") ids.forEach((id) => contactIds.add(id));
    if (field.type === "relation") ids.forEach((id) => itemIds.add(id));
  }
  const [contacts, items] = await Promise.all([
    contactIds.size > 0 ? admin.from("contacts").select("id, name").eq("owner_id", ownerId).in("id", [...contactIds]) : Promise.resolve({ data: [] }),
    itemIds.size > 0 ? admin.from("items").select("id, title").eq("owner_id", ownerId).in("id", [...itemIds]) : Promise.resolve({ data: [] }),
  ]);
  return {
    contactNames: new Map((contacts.data ?? []).map((c) => [c.id, c.name] as const)),
    itemTitles: new Map((items.data ?? []).map((i) => [i.id, i.title] as const)),
  };
}

/** `get_item` (mcp:read). */
export async function mcpGetItem(ctx: McpContext, input: Infer<typeof getItemInput>): Promise<GetItemResult | null> {
  const { admin, ownerId } = ctx;

  const item = await getItemDetail(admin, input.id);
  if (!item) return null;
  const { data: ownerCheck } = await admin.from("items").select("id").eq("id", input.id).eq("owner_id", ownerId).maybeSingle();
  if (!ownerCheck) return null;

  const [backlinks, includeFinanceContacts, { data: attachments }, { data: transcripts }] = await Promise.all([
    listBacklinks(admin, input.id),
    isFinanceContactsIndexingEnabled(admin, ownerId),
    admin.from("attachments").select("file_name").eq("item_id", input.id),
    admin.from("transcripts").select("summary").eq("item_id", input.id).eq("status", "completed"),
  ]);

  const propertyMaps = await resolvePropertyMapsForItem(admin, ownerId, item.type?.fields ?? [], item.properties);
  const propertiesChunk = chunkProperties(item.type?.fields ?? [], item.properties, propertyMaps, { includeFinanceContacts });

  const summary = transcripts?.find((t) => t.summary)?.summary as { resumo?: string } | null;

  return {
    id: item.id,
    title: item.title,
    type: item.type?.name ?? null,
    space: item.space?.name ?? null,
    properties: propertiesChunk?.text ?? "",
    contentMarkdown: tiptapDocToMarkdown(item.content),
    backlinks: backlinks.map((b) => ({ id: b.id, title: b.title })),
    attachments: (attachments ?? []).map((a) => a.file_name),
    transcriptSummary: summary?.resumo ?? null,
  };
}

export interface ListItemsResultRow {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

/** `list_items` (mcp:read) — mesmo recorte de `buildListItemsTool` (6.7): `filters`/`sort` do enunciado viraram só `query` no título. */
export async function mcpListItems(ctx: McpContext, input: Infer<typeof listItemsInput>): Promise<{ type: string; items: ListItemsResultRow[] } | { error: string }> {
  const { admin, ownerId } = ctx;

  const type = await resolveType(admin, ownerId, input.type);
  if (!type) return { error: `Tipo "${input.type}" não encontrado.` };

  let query = admin.from("items").select("id, title, status, updated_at, space_id").eq("owner_id", ownerId).eq("type_id", type.id).is("deleted_at", null);
  if (input.space) {
    const space = await resolveSpace(admin, ownerId, input.space);
    if (!space) return { error: `Espaço "${input.space}" não encontrado.` };
    query = query.eq("space_id", space.id);
  }
  const term = input.query?.trim().replace(/[,()%]/g, "");
  if (term) query = query.ilike("title", `%${term}%`);

  const { data } = await query.order("updated_at", { ascending: false }).limit(input.limit);

  return {
    type: type.name,
    items: (data ?? []).map((row) => ({ id: row.id, title: row.title || "Sem título", status: row.status, updatedAt: row.updated_at })),
  };
}

export interface SpaceAndTypeInfo {
  spaces: { id: string; name: string; slug: string }[];
  types: { id: string; name: string; slug: string; spaceId: string | null; fields: { key: string; label: string; type: string }[] }[];
}

/** `list_spaces_and_types` (mcp:read). */
export async function mcpListSpacesAndTypes(ctx: McpContext): Promise<SpaceAndTypeInfo> {
  const { admin, ownerId } = ctx;
  const [{ data: spaces }, { data: types }] = await Promise.all([
    admin.from("spaces").select("id, name, slug").eq("owner_id", ownerId).is("archived_at", null).order("position"),
    admin.from("object_types").select("id, name, slug, space_id, fields").eq("owner_id", ownerId).is("archived_at", null),
  ]);

  return {
    spaces: (spaces ?? []).map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
    types: (types ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      spaceId: t.space_id,
      fields: ((t.fields as unknown as FieldDefinition[] | null) ?? []).map((f) => ({ key: f.key, label: f.label, type: f.type })),
    })),
  };
}

export interface AskKnowledgeBaseResult {
  sources: { n: number; title: string; excerpt: string }[];
  contextText: string;
}

/** `ask_knowledge_base` (mcp:read) — só recuperação (`hybrid_search` + orçamento/diversidade, 6.7), sem chamar o Claude aqui (evitaria custo duplo, conforme o enunciado). */
export async function mcpAskKnowledgeBase(ctx: McpContext, input: Infer<typeof askKnowledgeBaseInput>): Promise<AskKnowledgeBaseResult> {
  const { admin, timezone } = ctx;
  const [spaceRows, typeRows] = await Promise.all([
    input.spaces && input.spaces.length > 0 ? Promise.all(input.spaces.map((slug) => resolveSpace(admin, ctx.ownerId, slug))) : Promise.resolve(null),
    input.types && input.types.length > 0 ? Promise.all(input.types.map((slug) => resolveType(admin, ctx.ownerId, slug))) : Promise.resolve(null),
  ]);

  const chunks = await retrieveChunks(admin, input.question, {
    spaceIds: spaceRows?.filter((s): s is NonNullable<typeof s> => s != null).map((s) => s.id),
    typeIds: typeRows?.filter((t): t is NonNullable<typeof t> => t != null).map((t) => t.id),
  }, timezone);

  const selected = selectChunksWithinBudget(chunks);
  const itemLabels = await fetchItemLabels(admin, [...new Set(selected.map((c) => c.itemId))]);
  const { contextText, sources } = buildAskContext(selected, itemLabels);

  return { contextText, sources: sources.map((s) => ({ n: s.n, title: s.title, excerpt: s.excerpt })) };
}

export interface EventResult {
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  kind: string;
}

/** `list_events` (mcp:read) — mesma composição de `fetchAgendaEvents` (3.6), sem passar pelo `requireOwner` (sem sessão aqui). */
export async function mcpListEvents(ctx: McpContext, input: Infer<typeof listEventsInput>): Promise<EventResult[]> {
  const { admin, ownerId, timezone } = ctx;
  const bounds = periodBoundsUtc(input.from, input.to, timezone);
  const startIso = bounds.startUtc ?? new Date(0).toISOString();
  const endIso = bounds.endUtc ?? new Date().toISOString();

  const [events, colors, dateFieldsByTypeId, reminders] = await Promise.all([
    listGoogleEventsInRange(admin, ownerId, startIso, endIso),
    listCalendarColors(admin, ownerId),
    listDateFieldsByTypeId(admin, ownerId),
    listRemindersInRange(admin, ownerId, startIso, endIso),
  ]);
  const items = await listItemsForDateExtraction(admin, ownerId, [...dateFieldsByTypeId.keys()]);

  const entries = [
    ...buildGoogleEventEntries(events, colors),
    ...extractItemDateEntries(items, dateFieldsByTypeId, startIso, endIso),
    ...buildReminderEntries(reminders),
  ];

  return entries.map((e) => ({ title: e.title, start: e.start, end: e.end, allDay: e.allDay, kind: e.kind }));
}

export interface TaskResult {
  id: string;
  title: string;
  status: string | null;
  prazo: string | null;
}

/**
 * `list_tasks` (mcp:read) — o tipo de sistema "Tarefa" (`slug = "tarefa"`,
 * `docs/fase-01-nucleo.md` 1.3) sempre tem os campos `status`/`prazo`; o
 * campo `project` (relação) só existe quando o pack de Projetos está
 * instalado (`packs/projetos.json`) — filtro ignorado se o campo não existir.
 */
export async function mcpListTasks(ctx: McpContext, input: Infer<typeof listTasksInput>): Promise<TaskResult[] | { error: string }> {
  const { admin, ownerId } = ctx;
  const type = await resolveType(admin, ownerId, "tarefa");
  if (!type) return { error: 'Tipo "Tarefa" não encontrado.' };

  const fields = (type.fields as unknown as FieldDefinition[] | null) ?? [];
  const statusField = fields.find((f) => f.key === "status" && f.type === "select");
  const projectField = fields.find((f) => f.key === "project" && f.type === "relation");

  const { data } = await admin.from("items").select("id, title, properties").eq("owner_id", ownerId).eq("type_id", type.id).is("deleted_at", null);
  let rows = data ?? [];

  if (input.status && statusField) {
    const option = statusField.options?.find((o) => o.label.toLowerCase() === input.status!.toLowerCase());
    const wanted = option?.id ?? input.status;
    rows = rows.filter((row) => (row.properties as Record<string, unknown> | null)?.status === wanted);
  }
  if (input.dueBefore) {
    rows = rows.filter((row) => {
      const prazo = (row.properties as Record<string, unknown> | null)?.prazo;
      return typeof prazo === "string" && prazo <= input.dueBefore!;
    });
  }
  if (input.project && projectField) {
    const { data: projectItems } = await admin.from("items").select("id").eq("owner_id", ownerId).ilike("title", `%${input.project}%`);
    const projectIds = new Set((projectItems ?? []).map((p) => p.id));
    rows = rows.filter((row) => {
      const raw = (row.properties as Record<string, unknown> | null)?.project;
      const ids = Array.isArray(raw) ? raw : [raw];
      return ids.some((id) => projectIds.has(String(id)));
    });
  }

  return rows.map((row) => {
    const properties = (row.properties as Record<string, unknown> | null) ?? {};
    const statusValue = typeof properties.status === "string" ? properties.status : null;
    const statusLabel = statusField?.options?.find((o) => o.id === statusValue)?.label ?? statusValue;
    return { id: row.id, title: row.title || "Sem título", status: statusLabel, prazo: typeof properties.prazo === "string" ? properties.prazo : null };
  });
}

export interface ContactResult {
  id: string;
  name: string;
  company: string | null;
  relationship: string;
  linkedItems: { id: string; title: string; typeName: string | null }[];
}

/** `get_contact` (mcp:read) — telefone/e-mail nunca aparecem (não existe escopo `contacts:read` no enunciado, então fica sempre fora). */
export async function mcpGetContact(ctx: McpContext, input: Infer<typeof getContactInput>): Promise<ContactResult | { error: string }> {
  const { admin } = ctx;

  let contact = input.id ? await getContactById(admin, input.id) : null;
  if (!contact && input.name) {
    const matches = await listContacts(admin, { search: input.name });
    if (matches[0]) contact = await getContactById(admin, matches[0].id);
  }
  if (!contact) return { error: "Contato não encontrado." };

  const activity = await getContactActivity(admin, contact);

  return {
    id: contact.id,
    name: contact.name,
    company: contact.company,
    relationship: contact.relationship,
    linkedItems: activity.linkedItems.slice(0, 20).map((i) => ({ id: i.id, title: i.title, typeName: i.typeName })),
  };
}

export interface FinanceSummaryResult {
  from: string;
  to: string;
  transactionCount: number;
  income: string;
  expense: string;
  result: string;
}

/** `finance_summary` (finance:read) — mesmo cálculo do painel financeiro (`computeTransactionTotals`). */
export async function mcpFinanceSummary(ctx: McpContext, input: Infer<typeof financeSummaryInput>): Promise<FinanceSummaryResult | { error: string }> {
  const { admin, ownerId } = ctx;
  let spaceId: string | undefined;
  if (input.space) {
    const space = await resolveSpace(admin, ownerId, input.space);
    if (!space) return { error: `Espaço "${input.space}" não encontrado.` };
    spaceId = space.id;
  }

  const rows = await listTransactions(admin, { periodStart: input.from, periodEnd: input.to, spaceId });
  const totals = computeTransactionTotals(rows);

  return {
    from: input.from,
    to: input.to,
    transactionCount: rows.length,
    income: formatBRL(totals.incomeCents),
    expense: formatBRL(totals.expenseCents),
    result: formatBRL(totals.resultCents),
  };
}

export interface TransactionResult {
  date: string;
  description: string;
  amount: string;
  category: string | null;
}

/** `list_transactions` (finance:read). */
export async function mcpListTransactions(ctx: McpContext, input: Infer<typeof listTransactionsInput>): Promise<{ totalFound: number; transactions: TransactionResult[] }> {
  const { admin } = ctx;
  const [rows, categories] = await Promise.all([
    listTransactions(admin, { periodStart: input.from, periodEnd: input.to, text: input.query }),
    listCategories(admin),
  ]);
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  return {
    totalFound: rows.length,
    transactions: rows.slice(0, input.limit).map((row) => ({
      date: row.occurredOn,
      description: row.description,
      amount: formatBRL(row.amountCents),
      category: row.categoryId ? (categoryNameById.get(row.categoryId) ?? null) : null,
    })),
  };
}
