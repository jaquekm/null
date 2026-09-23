import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JSONContent } from "@tiptap/core";
import type { ReportKind } from "@/features/reports/schemas";
import type { FieldDefinition } from "@/features/types/schemas";
import type { Database } from "@/lib/supabase/database.types";

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
  "id, resource_type, resource_id, token_prefix, permission, include_attachments, password_hash, expires_at, revoked_at, view_count, last_viewed_at, label, contact_id, created_at";

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

  return ((data ?? []) as unknown as (Record<string, unknown> & { items: { title: string } | null })[]).map((row) => ({
    ...mapShareLinkRow(row),
    itemTitle: row.items?.title ?? null,
  }));
}

export interface ShareLinkAuthRow {
  id: string;
  ownerId: string;
  resourceType: string;
  resourceId: string;
  permission: string;
  includeAttachments: boolean;
  showFullSplit: boolean;
  passwordHash: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

/** Busca por hash do token (3.11, `/p/[token]`) — sempre com cliente admin, sem sessão de usuário. */
export async function findShareLinkByTokenHash(admin: Client, tokenHash: string): Promise<ShareLinkAuthRow | null> {
  const { data } = await admin
    .from("share_links")
    .select("id, owner_id, resource_type, resource_id, permission, include_attachments, show_full_split, password_hash, expires_at, revoked_at")
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
    passwordHash: data.password_hash,
    expiresAt: data.expires_at,
    revokedAt: data.revoked_at,
  };
}

export interface PublicItemResource {
  title: string;
  content: JSONContent | null;
  properties: Record<string, unknown>;
  fields: FieldDefinition[];
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
    .select("title, content, properties, object_types(fields)")
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
