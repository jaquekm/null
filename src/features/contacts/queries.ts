import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Relationship } from "./schemas";

type Client = SupabaseClient<Database>;

export interface ContactRow {
  id: string;
  name: string;
  nickname: string | null;
  relationship: string;
  company: string | null;
  role: string | null;
  phoneE164: string | null;
  email: string | null;
  birthday: string | null;
  spaceId: string | null;
  preferredChannel: string;
  whatsappOptIn: boolean;
  emailOptIn: boolean;
  createdAt: string;
}

const LIST_COLUMNS =
  "id, name, nickname, relationship, company, role, phone_e164, email, birthday, space_id, preferred_channel, whatsapp_opt_in, email_opt_in, created_at";

function mapRow(row: Record<string, unknown>): ContactRow {
  return {
    id: row.id as string,
    name: row.name as string,
    nickname: row.nickname as string | null,
    relationship: row.relationship as string,
    company: row.company as string | null,
    role: row.role as string | null,
    phoneE164: row.phone_e164 as string | null,
    email: row.email as string | null,
    birthday: row.birthday as string | null,
    spaceId: row.space_id as string | null,
    preferredChannel: row.preferred_channel as string,
    whatsappOptIn: row.whatsapp_opt_in as boolean,
    emailOptIn: row.email_opt_in as boolean,
    createdAt: row.created_at as string,
  };
}

export interface ContactFilters {
  search?: string;
  relationship?: Relationship;
  company?: string;
  spaceId?: string;
  optIn?: boolean;
}

/** Lista de `/contatos` (3.3): busca por nome/apelido/e-mail/telefone + filtros. */
export async function listContacts(supabase: Client, filters: ContactFilters): Promise<ContactRow[]> {
  let query = supabase.from("contacts").select(LIST_COLUMNS).is("archived_at", null);

  if (filters.search?.trim()) {
    // `,()` têm significado especial na sintaxe de filtro do PostgREST usada por `.or()` —
    // removidos pra um termo de busca digitado não conseguir escapar do filtro pretendido.
    const term = filters.search.trim().replace(/[,()]/g, "");
    if (term) {
      query = query.or(
        `name.ilike.%${term}%,nickname.ilike.%${term}%,email.ilike.%${term}%,phone_e164.ilike.%${term}%`,
      );
    }
  }
  if (filters.relationship) query = query.eq("relationship", filters.relationship);
  if (filters.company?.trim()) query = query.ilike("company", `%${filters.company.trim()}%`);
  if (filters.spaceId) query = query.eq("space_id", filters.spaceId);
  if (filters.optIn === true) query = query.or("whatsapp_opt_in.eq.true,email_opt_in.eq.true");
  if (filters.optIn === false) query = query.eq("whatsapp_opt_in", false).eq("email_opt_in", false);

  const { data, error } = await query.order("name", { ascending: true });
  if (error) throw error;
  return data.map(mapRow);
}

export interface ContactDetailRow extends ContactRow {
  address: Record<string, unknown> | null;
  notes: string | null;
  avatarPath: string | null;
  consentAt: string | null;
  consentSource: string | null;
  optedOutAt: string | null;
}

const DETAIL_COLUMNS = `${LIST_COLUMNS}, address, notes, avatar_path, consent_at, consent_source, opted_out_at`;

export async function getContactById(supabase: Client, id: string): Promise<ContactDetailRow | null> {
  const { data, error } = await supabase.from("contacts").select(DETAIL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...mapRow(data),
    address: data.address as Record<string, unknown> | null,
    notes: data.notes,
    avatarPath: data.avatar_path,
    consentAt: data.consent_at,
    consentSource: data.consent_source,
    optedOutAt: data.opted_out_at,
  };
}

export interface LinkedItem {
  id: string;
  title: string;
  typeName: string | null;
  role: string | null;
  updatedAt: string;
}

export interface ContactEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  itemId: string | null;
}

export interface ContactReminder {
  id: string;
  title: string;
  sendAt: string;
  status: string;
}

export interface ContactDelivery {
  id: string;
  channel: string;
  status: string;
  renderedMessage: string;
  occurrenceAt: string;
}

export interface ContactActivity {
  linkedItems: LinkedItem[];
  events: ContactEvent[];
  reminders: ContactReminder[];
  deliveries: ContactDelivery[];
}

/**
 * Tudo que a página `/contatos/[id]` mostra além dos dados do contato (3.3):
 * itens ligados (`item_contacts`), eventos onde o contato é convidado
 * (`events.attendees`, casa pelo e-mail — vazio até a 3.4/3.5 existirem de
 * verdade), lembretes que incluem o contato e o histórico de entregas.
 */
export async function getContactActivity(supabase: Client, contact: ContactDetailRow): Promise<ContactActivity> {
  const [itemsResult, eventsResult, remindersResult, deliveriesResult] = await Promise.all([
    supabase
      .from("item_contacts")
      .select("role, items(id, title, updated_at, object_types(name))")
      .eq("contact_id", contact.id),
    contact.email
      ? supabase
          .from("events")
          .select("id, title, starts_at, ends_at, item_id")
          .contains("attendees", [{ email: contact.email }])
          .order("starts_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("reminders")
      .select("id, title, send_at, status")
      .contains("contact_ids", [contact.id])
      .order("send_at", { ascending: true }),
    supabase
      .from("reminder_deliveries")
      .select("id, channel, status, rendered_message, occurrence_at")
      .eq("contact_id", contact.id)
      .order("occurrence_at", { ascending: false })
      .limit(50),
  ]);

  const linkedItems: LinkedItem[] = (itemsResult.data ?? []).flatMap((row) => {
    const item = row.items as unknown as { id: string; title: string; updated_at: string; object_types: { name: string } | null } | null;
    if (!item) return [];
    return [{ id: item.id, title: item.title, typeName: item.object_types?.name ?? null, role: row.role, updatedAt: item.updated_at }];
  });

  const events: ContactEvent[] = (eventsResult.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    itemId: row.item_id,
  }));

  const reminders: ContactReminder[] = (remindersResult.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    sendAt: row.send_at,
    status: row.status,
  }));

  const deliveries: ContactDelivery[] = (deliveriesResult.data ?? []).map((row) => ({
    id: row.id,
    channel: row.channel,
    status: row.status,
    renderedMessage: row.rendered_message,
    occurrenceAt: row.occurrence_at,
  }));

  return { linkedItems, events, reminders, deliveries };
}

export interface ContactMentionResult {
  id: string;
  name: string;
}

/** Busca pro menu `@` de menção de contatos no editor (3.3). */
export async function searchContactsForMention(supabase: Client, query: string): Promise<ContactMentionResult[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase
    .from("contacts")
    .select("id, name")
    .is("archived_at", null)
    .ilike("name", `%${query.trim()}%`)
    .order("name", { ascending: true })
    .limit(8);
  if (error) return [];
  return data;
}

export interface ContactAttendeeResult {
  id: string;
  name: string;
  email: string;
}

/** Busca de convidados a partir de contatos, pro diálogo de criar/editar evento (3.6) — só quem tem e-mail cadastrado. */
export async function searchContactsForAttendees(supabase: Client, query: string): Promise<ContactAttendeeResult[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, email")
    .is("archived_at", null)
    .not("email", "is", null)
    .ilike("name", `%${query.trim()}%`)
    .order("name", { ascending: true })
    .limit(8);
  if (error) return [];
  return data as ContactAttendeeResult[];
}

export interface DuplicateMatch {
  id: string;
  name: string;
  matchedBy: "phone" | "email";
}

/** Detecção de duplicados na importação (3.3) — por telefone (já em E.164) ou e-mail. */
export async function findDuplicateContacts(
  supabase: Client,
  input: { phoneE164?: string | null; email?: string | null },
): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];

  if (input.phoneE164) {
    const { data } = await supabase.from("contacts").select("id, name").eq("phone_e164", input.phoneE164).limit(1);
    for (const row of data ?? []) matches.push({ id: row.id, name: row.name, matchedBy: "phone" });
  }
  if (input.email && matches.length === 0) {
    const { data } = await supabase.from("contacts").select("id, name").ilike("email", input.email).limit(1);
    for (const row of data ?? []) matches.push({ id: row.id, name: row.name, matchedBy: "email" });
  }
  return matches;
}
