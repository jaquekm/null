import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JSONContent } from "@tiptap/core";
import type { ReportKind } from "@/features/reports/schemas";
import type { FieldDefinition } from "@/features/types/schemas";
import type { Database } from "@/lib/supabase/database.types";
import { mergeLinkActivity, type LinkActivity } from "./lib/link-activity";

type Client = SupabaseClient<Database>;

export interface ShareLinkRow {
  id: string;
  resourceType: string;
  resourceId: string;
  tokenPrefix: string;
  permission: string;
  includeAttachments: boolean;
  hasPassword: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  label: string | null;
  contactId: string | null;
  createdAt: string;
}

function mapShareLinkRow(row: Record<string, unknown>): ShareLinkRow {
  return {
    id: row.id as string,
    resourceType: row.resource_type as string,
    resourceId: row.resource_id as string,
    tokenPrefix: row.token_prefix as string,
    permission: row.permission as string,
    includeAttachments: row.include_attachments as boolean,
    hasPassword: row.password_hash != null,
    expiresAt: row.expires_at as string | null,
    revokedAt: row.revoked_at as string | null,
    viewCount: row.view_count as number,
    lastViewedAt: row.last_viewed_at as string | null,
    label: row.label as string | null,
    contactId: row.contact_id as string | null,
    createdAt: row.created_at as string,
  };
}

const SHARE_LINK_COLUMNS =
  "id, resource_type, resource_id, tag_id, token_prefix, permission, include_attachments, password_hash, expires_at, revoked_at, view_count, last_viewed_at, label, contact_id, created_at";

/** Links de compartilhamento de um item (3.11, diálogo "Compartilhar"). */
export async function listShareLinksForItem(supabase: Client, itemId: string): Promise<ShareLinkRow[]> {
  const { data } = await supabase
    .from("share_links")
    .select(SHARE_LINK_COLUMNS)
    .eq("resource_type", "item")
    .eq("resource_id", itemId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapShareLinkRow);
}

export interface ShareLinkWithItemRow extends ShareLinkRow {
  itemTitle: string | null;
}

/** `/configuracoes/compartilhamentos` (3.11): todos os links do dono, com o título do item. */
export async function listAllShareLinks(supabase: Client): Promise<ShareLinkWithItemRow[]> {
  const { data } = await supabase
    .from("share_links")
    .select(`${SHARE_LINK_COLUMNS}, items(title)`)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as (Record<string, unknown> & { items: { title: string } | null })[];

  // Link de espaço (9.7): o nome vem do espaço (e da subcategoria, se o link for só dela).
  const spaceRows = rows.filter((row) => row.resource_type === "space");
  const spaceNames = new Map<string, string>();
  const tagNames = new Map<string, string>();
  if (spaceRows.length > 0) {
    const tagIds = [...new Set(spaceRows.map((row) => row.tag_id as string | null).filter((id): id is string => Boolean(id)))];
    const [{ data: spaces }, { data: tags }] = await Promise.all([
      supabase.from("spaces").select("id, name").in("id", [...new Set(spaceRows.map((row) => row.resource_id as string))]),
      tagIds.length > 0 ? supabase.from("tags").select("id, name").in("id", tagIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    for (const space of spaces ?? []) spaceNames.set(space.id, space.name);
    for (const tag of tags ?? []) tagNames.set(tag.id, tag.name);
  }

  return rows.map((row) => {
    if (row.resource_type === "space") {
      const space = spaceNames.get(row.resource_id as string) ?? "Espaço";
      const tag = row.tag_id ? tagNames.get(row.tag_id as string) : null;
      return { ...mapShareLinkRow(row), itemTitle: tag ? `${space} · ${tag}` : `${space} (espaço inteiro)` };
    }
    return { ...mapShareLinkRow(row), itemTitle: row.items?.title ?? null };
  });
}

export interface ShareLinkAuthRow {
  id: string;
  ownerId: string;
  resourceType: string;
  resourceId: string;
  permission: string;
  includeAttachments: boolean;
  showFullSplit: boolean;
  /** Link de espaço (9.7) restrito a uma subcategoria. */
  tagId: string | null;
  passwordHash: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  /** Nome dado ao link — num link de edição, é o nome de quem usa. */
  label: string | null;
}

/** Busca por hash do token (3.11, `/p/[token]`) — sempre com cliente admin, sem sessão de usuário. */
export async function findShareLinkByTokenHash(admin: Client, tokenHash: string): Promise<ShareLinkAuthRow | null> {
  const { data } = await admin
    .from("share_links")
    .select("id, owner_id, resource_type, resource_id, permission, include_attachments, show_full_split, tag_id, password_hash, expires_at, revoked_at, label")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return null;

  return {
    id: data.id,
    ownerId: data.owner_id,
    resourceType: data.resource_type,
    resourceId: data.resource_id,
    permission: data.permission,
    includeAttachments: data.include_attachments,
    showFullSplit: data.show_full_split,
    tagId: data.tag_id,
    passwordHash: data.password_hash,
    expiresAt: data.expires_at,
    revokedAt: data.revoked_at,
    label: data.label,
  };
}

export interface PublicItemResource {
  title: string;
  content: JSONContent | null;
  properties: Record<string, unknown>;
  fields: FieldDefinition[];
  /** Slug do tipo do item ("lista" libera a edição por link). */
  typeSlug: string | null;
}

/**
 * O item referenciado por um link público (3.11) — só os campos que a
 * página `/p/[token]` de fato usa (nunca `owner_id`, tags, backlinks ou
 * qualquer outro item). Escopado pelo `ownerId` do próprio link, não só
 * pelo `itemId` — mesmo sendo um app de dono único, é a checagem certa a
 * fazer (o dado já existe pra isso).
 */
export async function getPublicItemResource(admin: Client, ownerId: string, itemId: string): Promise<PublicItemResource | null> {
  const { data } = await admin
    .from("items")
    .select("title, content, properties, object_types(slug, fields)")
    .eq("id", itemId)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;

  return {
    title: data.title,
    content: (data.content as unknown as JSONContent | null) ?? null,
    properties: (data.properties as Record<string, unknown> | null) ?? {},
    fields: (data.object_types?.fields as unknown as FieldDefinition[] | null) ?? [],
    typeSlug: data.object_types?.slug ?? null,
  };
}

export interface PublicAttachmentFile {
  storagePath: string;
  fileName: string;
}

/** Anexo específico de um link público (3.11), pra gerar a URL assinada de 10 min — escopado ao item e dono do link. */
export async function getPublicAttachmentFile(admin: Client, ownerId: string, itemId: string, attachmentId: string): Promise<PublicAttachmentFile | null> {
  const { data } = await admin
    .from("attachments")
    .select("storage_path, file_name, item_id, items!inner(owner_id)")
    .eq("id", attachmentId)
    .eq("item_id", itemId)
    .eq("items.owner_id", ownerId)
    .maybeSingle();
  if (!data) return null;

  return { storagePath: data.storage_path, fileName: data.file_name };
}

export interface PublicSplitShareResource {
  splitTitle: string;
  occurredOn: string;
  totalCents: number;
  shareCents: number;
  settledCents: number;
  claimedPaidAt: string | null;
  participantName: string | null;
  status: string;
  attachmentId: string | null;
  /** `null` = eu paguei (a parte desse participante vem pra mim — só aí faz sentido mostrar meu Pix). Se for outro contato, o dinheiro nem passa por mim. */
  paidByContactId: string | null;
  /** Só preenchido quando o link tem `show_full_split` — a divisão inteira, não só a parte de quem abriu o link. */
  fullSplit: { participantName: string; shareCents: number; settledCents: number }[] | null;
}

/**
 * A parte de UM participante de uma divisão (4.10) — `shareId` é o id da
 * linha de `fin_split_shares`, não da divisão (`resource_id` do link é por
 * participante, pra ninguém ver o valor de outra pessoa por padrão).
 */
export async function getPublicSplitShareResource(
  admin: Client,
  ownerId: string,
  shareId: string,
  options: { showFullSplit: boolean },
): Promise<PublicSplitShareResource | null> {
  const { data } = await admin
    .from("fin_split_shares")
    .select(
      "split_id, share_cents, settled_cents, claimed_paid_at, contacts(name), fin_splits!inner(title, occurred_on, total_cents, status, attachment_id, paid_by_contact_id)",
    )
    .eq("id", shareId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!data) return null;

  const split = data.fin_splits as unknown as {
    title: string;
    occurred_on: string;
    total_cents: number;
    status: string;
    attachment_id: string | null;
    paid_by_contact_id: string | null;
  };
  const contact = data.contacts as unknown as { name: string } | null;

  let fullSplit: PublicSplitShareResource["fullSplit"] = null;
  if (options.showFullSplit) {
    const { data: shares } = await admin.from("fin_split_shares").select("share_cents, settled_cents, contacts(name)").eq("split_id", data.split_id);
    fullSplit = (shares ?? []).map((row) => ({
      participantName: (row.contacts as unknown as { name: string } | null)?.name ?? "Eu",
      shareCents: row.share_cents as number,
      settledCents: row.settled_cents as number,
    }));
  }

  return {
    splitTitle: split.title,
    occurredOn: split.occurred_on,
    totalCents: split.total_cents,
    shareCents: data.share_cents,
    settledCents: data.settled_cents,
    claimedPaidAt: data.claimed_paid_at,
    participantName: contact?.name ?? null,
    status: split.status,
    attachmentId: split.attachment_id,
    paidByContactId: split.paid_by_contact_id,
    fullSplit,
  };
}

export interface PublicBillResource {
  description: string;
  dueOn: string;
  amountCents: number;
  paidCents: number;
  status: string;
  direction: string;
  claimedPaidAt: string | null;
  pixCode: string | null;
  attachmentId: string | null;
}

/** Conta a pagar/receber atrás de um link público (4.10) — escopada por `ownerId`, igual ao item. */
export async function getPublicBillResource(admin: Client, ownerId: string, billId: string): Promise<PublicBillResource | null> {
  const { data } = await admin
    .from("fin_bills")
    .select("description, due_on, amount_cents, paid_cents, status, direction, claimed_paid_at, pix_code, attachment_id")
    .eq("id", billId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!data) return null;

  return {
    description: data.description,
    dueOn: data.due_on,
    amountCents: data.amount_cents,
    paidCents: data.paid_cents,
    status: data.status,
    direction: data.direction,
    claimedPaidAt: data.claimed_paid_at,
    pixCode: data.pix_code,
    attachmentId: data.attachment_id,
  };
}

export interface PublicReportRunResource {
  kind: ReportKind;
  title: string;
  periodStart: string | null;
  periodEnd: string | null;
  data: unknown;
  aiSummary: string | null;
  pdfAttachmentId: string | null;
  createdAt: string;
}

/**
 * Snapshot de uma execução de relatório atrás de um link público (6.4) — só
 * `report_runs`, exatamente como o enunciado pede ("renderiza somente o
 * snapshot"), nunca recalculado. Escopado por `ownerId`, igual aos outros
 * recursos públicos.
 */
export async function getPublicReportRunResource(admin: Client, ownerId: string, reportRunId: string): Promise<PublicReportRunResource | null> {
  const { data } = await admin
    .from("report_runs")
    .select("kind, title, period_start, period_end, data, ai_summary, pdf_attachment_id, created_at")
    .eq("id", reportRunId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!data) return null;

  return {
    kind: data.kind as ReportKind,
    title: data.title,
    periodStart: data.period_start,
    periodEnd: data.period_end,
    data: data.data,
    aiSummary: data.ai_summary,
    pdfAttachmentId: data.pdf_attachment_id,
    createdAt: data.created_at,
  };
}

export interface ShareCommentRow {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

/** Comentários recebidos por links `comment` de um item (3.11: "Comentários aparecem no item para o dono"). */
export async function listItemShareComments(supabase: Client, itemId: string): Promise<ShareCommentRow[]> {
  const { data } = await supabase
    .from("share_comments")
    .select("id, author_name, body, created_at, share_links!inner(resource_id, resource_type)")
    .eq("share_links.resource_type", "item")
    .eq("share_links.resource_id", itemId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({ id: row.id, authorName: row.author_name, body: row.body, createdAt: row.created_at }));
}

export interface PublicSpaceItem {
  id: string;
  title: string;
  typeName: string | null;
  typeIcon: string | null;
  subcategories: string[];
  updatedAt: string;
}

export interface PublicSpaceResource {
  name: string;
  icon: string | null;
  /** Nome da subcategoria quando o link é só dela. */
  subcategory: string | null;
  items: PublicSpaceItem[];
}

/** Até quantos itens a página de um espaço compartilhado lista (9.7). */
export const PUBLIC_SPACE_ITEM_LIMIT = 500;

/**
 * Espaço compartilhado (9.7): o nome e a lista de itens ativos (sem lixeira
 * nem arquivados), com o tipo e as subcategorias de cada um — nada de
 * conteúdo aqui; cada item abre na própria página do link
 * (`getPublicSpaceItem`). Com `tagId`, só os itens daquela subcategoria.
 */
export async function getPublicSpaceResource(admin: Client, ownerId: string, spaceId: string, tagId: string | null): Promise<PublicSpaceResource | null> {
  const { data: space } = await admin.from("spaces").select("name, icon").eq("id", spaceId).eq("owner_id", ownerId).is("archived_at", null).maybeSingle();
  if (!space) return null;

  let subcategory: string | null = null;
  if (tagId) {
    const { data: tag } = await admin.from("tags").select("name").eq("id", tagId).eq("owner_id", ownerId).maybeSingle();
    if (!tag) return null;
    subcategory = tag.name;
  }

  let query = admin
    .from("items")
    .select(tagId ? "id, title, updated_at, object_types(name, icon), item_tags!inner(tag_id)" : "id, title, updated_at, object_types(name, icon)")
    .eq("owner_id", ownerId)
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(PUBLIC_SPACE_ITEM_LIMIT);
  if (tagId) query = query.eq("item_tags.tag_id", tagId);
  const { data: rows } = await query;
  const items = (rows ?? []) as unknown as { id: string; title: string; updated_at: string; object_types: { name: string; icon: string | null } | null }[];

  const tagsByItem = new Map<string, string[]>();
  if (items.length > 0) {
    const { data: tagRows } = await admin
      .from("item_tags")
      .select("item_id, tags(name)")
      .eq("owner_id", ownerId)
      .in(
        "item_id",
        items.map((item) => item.id),
      );
    for (const row of (tagRows ?? []) as unknown as { item_id: string; tags: { name: string } | null }[]) {
      if (!row.tags) continue;
      tagsByItem.set(row.item_id, [...(tagsByItem.get(row.item_id) ?? []), row.tags.name]);
    }
  }

  return {
    name: space.name,
    icon: space.icon,
    subcategory,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      typeName: item.object_types?.name ?? null,
      typeIcon: item.object_types?.icon ?? null,
      subcategories: (tagsByItem.get(item.id) ?? []).sort(),
      updatedAt: item.updated_at,
    })),
  };
}

/**
 * Um item de dentro de um espaço compartilhado (9.7) — só se ele está
 * mesmo naquele espaço (e na subcategoria do link, quando houver), ativo e
 * fora da lixeira. Qualquer outro id devolve `null` (link não abre item de
 * fora só trocando o endereço).
 */
export async function getPublicSpaceItem(
  admin: Client,
  ownerId: string,
  spaceId: string,
  tagId: string | null,
  itemId: string,
): Promise<PublicItemResource | null> {
  const { data } = await admin
    .from("items")
    .select("title, content, properties, status, space_id, object_types(slug, fields)")
    .eq("id", itemId)
    .eq("owner_id", ownerId)
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data || data.status === "archived") return null;

  if (tagId) {
    const { data: tagged } = await admin.from("item_tags").select("item_id").eq("item_id", itemId).eq("tag_id", tagId).maybeSingle();
    if (!tagged) return null;
  }

  return {
    title: data.title,
    content: (data.content as unknown as JSONContent | null) ?? null,
    properties: (data.properties as Record<string, unknown> | null) ?? {},
    fields: (data.object_types?.fields as unknown as FieldDefinition[] | null) ?? [],
    typeSlug: data.object_types?.slug ?? null,
  };
}

/**
 * "Nos seus links" (9.7): comentários e marcações ainda não vistos nos links
 * da dona, mais recentes primeiro. Comentário vem de `share_comments` (link
 * de item); marcação, de `share_link_events`.
 */
export async function listUnreadLinkActivity(supabase: Client, limit = 20): Promise<{ items: LinkActivity[]; total: number }> {
  const [{ data: comments, count: commentCount }, { data: events, count: eventCount }] = await Promise.all([
    supabase
      .from("share_comments")
      .select("id, author_name, body, created_at, share_links!inner(resource_type, resource_id)", { count: "exact" })
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("share_link_events")
      .select("id, kind, detail, item_id, created_at, items(title), share_links(label, permission)", { count: "exact" })
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  type CommentRow = { id: string; author_name: string; body: string; created_at: string; share_links: { resource_type: string; resource_id: string } | null };
  const commentRows = (comments ?? []) as unknown as CommentRow[];
  const itemIds = [...new Set(commentRows.filter((row) => row.share_links?.resource_type === "item").map((row) => row.share_links!.resource_id))];
  const titles = new Map<string, string>();
  if (itemIds.length > 0) {
    const { data: items } = await supabase.from("items").select("id, title").in("id", itemIds);
    for (const item of items ?? []) titles.set(item.id, item.title);
  }

  const fromComments: LinkActivity[] = commentRows.map((row) => {
    const itemId = row.share_links?.resource_type === "item" ? row.share_links.resource_id : null;
    return { id: `c:${row.id}`, kind: "comment", author: row.author_name, text: row.body, itemId, itemTitle: itemId ? (titles.get(itemId) ?? null) : null, createdAt: row.created_at };
  });
  type EventRow = {
    id: string;
    kind: string;
    detail: string | null;
    item_id: string | null;
    created_at: string;
    items: { title: string } | null;
    share_links: { label: string | null; permission: string } | null;
  };
  const fromEvents: LinkActivity[] = ((events ?? []) as unknown as EventRow[]).map((row) => ({
    id: `e:${row.id}`,
    kind: (["uncheck", "add", "rate", "edit", "delete"] as const).find((k) => k === row.kind) ?? "check",
    // Só o link de edição é "uma pessoa" (um link por pessoa); nos outros a marcação é anônima.
    author: row.share_links?.permission === "edit" ? (row.share_links.label ?? null) : null,
    text: row.detail,
    itemId: row.item_id,
    itemTitle: row.items?.title ?? null,
    createdAt: row.created_at,
  }));

  return { items: mergeLinkActivity(fromComments, fromEvents).slice(0, limit), total: (commentCount ?? 0) + (eventCount ?? 0) };
}
