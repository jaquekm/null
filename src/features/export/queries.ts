import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FieldDefinition } from "@/features/types/schemas";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface ExportItemRow {
  id: string;
  title: string;
  spaceName: string | null;
  typeName: string | null;
  typeSlug: string | null;
  typeFields: FieldDefinition[];
  status: string;
  content: unknown;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Todos os itens do dono, não excluídos — base do export completo (7.4), um `.md` por item em `espacos/<espaço>/<tipo>/`. */
export async function listItemsForExport(admin: Client, ownerId: string): Promise<ExportItemRow[]> {
  const { data, error } = await admin
    .from("items")
    .select("id, title, status, content, properties, created_at, updated_at, spaces(name), object_types(name, slug, fields)")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title || "Sem título",
    spaceName: row.spaces?.name ?? null,
    typeName: row.object_types?.name ?? null,
    typeSlug: row.object_types?.slug ?? null,
    typeFields: ((row.object_types?.fields as unknown as FieldDefinition[] | null) ?? []),
    status: row.status,
    content: row.content,
    properties: (row.properties as Record<string, unknown> | null) ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/** Títulos dos itens ligados por `links` (saída, qualquer `kind`) — pra virarem `[[titulo]]` no Markdown exportado. */
export async function listOutgoingLinkTitlesByItemIds(admin: Client, ownerId: string, itemIds: string[]): Promise<Map<string, string[]>> {
  const byItem = new Map<string, string[]>();
  if (itemIds.length === 0) return byItem;

  const { data: links, error } = await admin.from("links").select("source_id, target_id").eq("owner_id", ownerId).in("source_id", itemIds);
  if (error) throw error;
  if (!links || links.length === 0) return byItem;

  const targetIds = [...new Set(links.map((l) => l.target_id))];
  const { data: targets } = await admin.from("items").select("id, title").in("id", targetIds);
  const titleById = new Map((targets ?? []).map((t) => [t.id, t.title || "Sem título"]));

  for (const link of links) {
    const title = titleById.get(link.target_id);
    if (!title) continue;
    const list = byItem.get(link.source_id) ?? [];
    list.push(title);
    byItem.set(link.source_id, list);
  }
  return byItem;
}

export interface ExportAttachmentRow {
  id: string;
  itemId: string;
  storagePath: string;
  fileName: string;
}

/** Anexos ligados a um item (avulsos — `item_id` nulo, ex.: PDF de relatório — ficam de fora, são regeráveis). */
export async function listAttachmentsForExport(admin: Client, ownerId: string): Promise<ExportAttachmentRow[]> {
  const { data, error } = await admin.from("attachments").select("id, item_id, storage_path, file_name").eq("owner_id", ownerId);
  if (error) throw error;
  return (data ?? [])
    .filter((row) => row.item_id != null)
    .map((row) => ({ id: row.id, itemId: row.item_id as string, storagePath: row.storage_path, fileName: row.file_name }));
}

export interface ExportTranscriptRow {
  itemId: string;
  segments: unknown;
  speakerNames: Record<string, string>;
}

/** Transcrições concluídas, com segmentos — vira `.md` via `exportAsMarkdown` (2.8), reaproveitado aqui. */
export async function listTranscriptsForExport(admin: Client, ownerId: string): Promise<ExportTranscriptRow[]> {
  const { data, error } = await admin.from("transcripts").select("item_id, segments, speaker_names").eq("owner_id", ownerId).eq("status", "completed");
  if (error) throw error;
  return (data ?? [])
    .filter((row) => row.segments != null)
    .map((row) => ({
      itemId: row.item_id,
      segments: row.segments,
      speakerNames: (row.speaker_names as Record<string, string> | null) ?? {},
    }));
}

export interface ExportCanvasRow {
  itemId: string;
  canvas: { viewport: unknown; settings: unknown };
  nodes: unknown[];
  edges: unknown[];
}

/** Um `.json` por canvas (`{ canvas, nodes, edges }`) — mesmas consultas de `features/canvas/queries.ts`, sem os campos resolvidos de exibição (título/ícone/nome de contato), que não fazem sentido fora da tela. */
export async function listCanvasesForExport(admin: Client, ownerId: string): Promise<ExportCanvasRow[]> {
  const { data: canvases, error } = await admin.from("canvases").select("id, item_id, viewport, settings").eq("owner_id", ownerId);
  if (error) throw error;
  if (!canvases || canvases.length === 0) return [];

  const canvasIds = canvases.map((c) => c.id);
  const [{ data: nodes }, { data: edges }] = await Promise.all([
    admin.from("canvas_nodes").select("*").in("canvas_id", canvasIds),
    admin.from("canvas_edges").select("*").in("canvas_id", canvasIds),
  ]);

  return canvases.map((c) => ({
    itemId: c.item_id,
    canvas: { viewport: c.viewport, settings: c.settings },
    nodes: (nodes ?? []).filter((n) => n.canvas_id === c.id),
    edges: (edges ?? []).filter((e) => e.canvas_id === c.id),
  }));
}

/** Dump JSON cru de uma tabela do dono — camada "sem perder nada" do export completo (7.4), embaixo das visões curadas (Markdown/CSV/ICS/vCard) acima. */
export async function dumpOwnerTable(admin: Client, ownerId: string, table: keyof Database["public"]["Tables"]): Promise<unknown[]> {
  const { data, error } = await admin.from(table).select("*").eq("owner_id", ownerId);
  if (error) throw error;
  return data ?? [];
}

/**
 * Tabelas de dados do usuário incluídas em `dados-brutos/*.json` (7.4).
 * Fora da lista, de propósito: tabelas de auditoria/operacionais
 * (`jobs`, `job_schedules`, `usage_events`, `automation_runs`,
 * `automation_event_log`, `mcp_audit`, `share_link_views`,
 * `reminder_deliveries`, `fin_imports`, `backup_runs`), dados derivados que
 * podem ser recalculados (`item_chunks`, os embeddings) e tabelas com
 * credenciais/segredos mesmo que só o hash/cifrado apareça (`api_tokens`,
 * `google_connections`, `push_subscriptions`) — ver `docs/decisoes.md`.
 */
export const RAW_DUMP_TABLES: (keyof Database["public"]["Tables"])[] = [
  "user_settings",
  "spaces",
  "object_types",
  "items",
  "tags",
  "item_tags",
  "links",
  "item_versions",
  "views",
  "contacts",
  "item_contacts",
  "calendars",
  "events",
  "reminders",
  "reminder_rules",
  "fin_accounts",
  "fin_categories",
  "fin_card_statements",
  "fin_recurring",
  "fin_bills",
  "fin_transactions",
  "fin_rules",
  "fin_splits",
  "fin_split_shares",
  "fin_pix_keys",
  "fin_budget_alerts",
  "automations",
  "packs_installed",
  "canvases",
  "canvas_nodes",
  "canvas_edges",
  "review_cards",
  "review_logs",
  "study_sessions",
  "report_definitions",
  "report_runs",
  "ai_conversations",
  "ai_messages",
  "share_links",
  "share_comments",
  "attachments",
  "transcripts",
];

export interface ExportContactRow {
  name: string;
  nickname: string | null;
  relationship: string;
  company: string | null;
  role: string | null;
  phoneE164: string | null;
  email: string | null;
  birthday: string | null;
  spaceName: string | null;
  notes: string | null;
}

export async function listContactsForExport(admin: Client, ownerId: string): Promise<ExportContactRow[]> {
  const { data, error } = await admin
    .from("contacts")
    .select("name, nickname, relationship, company, role, phone_e164, email, birthday, notes, spaces(name)")
    .eq("owner_id", ownerId)
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    name: row.name,
    nickname: row.nickname,
    relationship: row.relationship,
    company: row.company,
    role: row.role,
    phoneE164: row.phone_e164,
    email: row.email,
    birthday: row.birthday,
    spaceName: row.spaces?.name ?? null,
    notes: row.notes,
  }));
}

export interface ExportTransactionRow {
  occurredOn: string;
  description: string;
  amountCents: number;
  categoryName: string | null;
  accountName: string;
  contactName: string | null;
  tags: string[];
}

/** Todos os lançamentos do dono, sem filtro de período (`listTransactions` exige `periodStart`/`periodEnd` — não serve pro export completo). */
export async function listAllTransactionsForExport(admin: Client, ownerId: string): Promise<ExportTransactionRow[]> {
  const [{ data: transactions, error }, { data: accounts }, { data: categories }, { data: contacts }] = await Promise.all([
    admin
      .from("fin_transactions")
      .select("occurred_on, description, amount_cents, category_id, account_id, contact_id, tags")
      .eq("owner_id", ownerId)
      .order("occurred_on", { ascending: true }),
    admin.from("fin_accounts").select("id, name").eq("owner_id", ownerId),
    admin.from("fin_categories").select("id, name").eq("owner_id", ownerId),
    admin.from("contacts").select("id, name").eq("owner_id", ownerId),
  ]);
  if (error) throw error;

  const accountNameById = new Map((accounts ?? []).map((a) => [a.id, a.name]));
  const categoryNameById = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const contactNameById = new Map((contacts ?? []).map((c) => [c.id, c.name]));

  return (transactions ?? []).map((t) => ({
    occurredOn: t.occurred_on,
    description: t.description,
    amountCents: t.amount_cents,
    categoryName: t.category_id ? (categoryNameById.get(t.category_id) ?? null) : null,
    accountName: accountNameById.get(t.account_id) ?? "",
    contactName: t.contact_id ? (contactNameById.get(t.contact_id) ?? null) : null,
    tags: t.tags ?? [],
  }));
}

export interface ExportFlashcardRow {
  front: string;
  back: string;
  deckTitle: string;
}

/** Flashcards do dono (pack Estudos, 5.7), com o título do baralho (`review_cards.deck_item_id`) resolvido — `flashcardTypeId` vem de `getStudyTypeIds`. */
export async function listFlashcardsForExport(admin: Client, ownerId: string, flashcardTypeId: string): Promise<ExportFlashcardRow[]> {
  const { data: items, error } = await admin
    .from("items")
    .select("id, properties")
    .eq("owner_id", ownerId)
    .eq("type_id", flashcardTypeId)
    .is("deleted_at", null);
  if (error) throw error;
  if (!items || items.length === 0) return [];

  const { data: reviewCards } = await admin.from("review_cards").select("item_id, deck_item_id").eq("owner_id", ownerId);
  const deckItemIdByItemId = new Map((reviewCards ?? []).map((r) => [r.item_id, r.deck_item_id]));

  const deckIds = [...new Set([...deckItemIdByItemId.values()].filter((id): id is string => id != null))];
  const { data: decks } = deckIds.length > 0 ? await admin.from("items").select("id, title").in("id", deckIds) : { data: [] };
  const deckTitleById = new Map((decks ?? []).map((d) => [d.id, d.title || "Sem título"]));

  return items.map((item) => {
    const properties = (item.properties as Record<string, unknown> | null) ?? {};
    const deckItemId = deckItemIdByItemId.get(item.id) ?? null;
    return {
      front: typeof properties.front === "string" ? properties.front : "",
      back: typeof properties.back === "string" ? properties.back : "",
      deckTitle: deckItemId ? (deckTitleById.get(deckItemId) ?? "") : "",
    };
  });
}

export interface ExportEventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  status: "confirmed" | "tentative" | "cancelled";
}

export async function listEventsForExport(admin: Client, ownerId: string): Promise<ExportEventRow[]> {
  const { data, error } = await admin
    .from("events")
    .select("id, title, description, location, starts_at, ends_at, all_day, status")
    .eq("owner_id", ownerId)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    status: row.status as "confirmed" | "tentative" | "cancelled",
  }));
}
