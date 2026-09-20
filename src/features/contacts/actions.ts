"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import {
  findDuplicateContacts,
  listContacts,
  searchContactsForAttendees as searchContactsForAttendeesQuery,
  searchContactsForMention as searchContactsForMentionQuery,
  type ContactAttendeeResult,
  type ContactFilters,
  type ContactRow,
} from "./queries";
import { normalizePhoneToE164 } from "./lib/normalize-phone";
import { mergeContactFields, type MergeableContact } from "./lib/merge-contact-fields";
import { parseVCard } from "./lib/parse-vcard";
import { consentInputSchema, contactInputSchema, csvColumnKeys, type CsvColumnKey } from "./schemas";

const GENERIC_ERROR = "Não foi possível salvar o contato. Tente de novo.";

function toNullable(value: string | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

/** "Criar/editar" (3.3) — telefone normalizado pra E.164 (BR); vazio ou inválido vira `null`/erro de campo. */
export async function createContact(input: z.input<typeof contactInputSchema>): Promise<Result<{ id: string }>> {
  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const { supabase, user } = await requireOwner();

  let phoneE164: string | null = null;
  if (parsed.data.phone?.trim()) {
    phoneE164 = normalizePhoneToE164(parsed.data.phone);
    if (!phoneE164) return fail("Telefone inválido.", { phone: ["Telefone inválido."] });
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      nickname: toNullable(parsed.data.nickname),
      relationship: parsed.data.relationship,
      company: toNullable(parsed.data.company),
      role: toNullable(parsed.data.role),
      phone_e164: phoneE164,
      email: toNullable(parsed.data.email),
      birthday: toNullable(parsed.data.birthday),
      address: parsed.data.address ?? null,
      notes: toNullable(parsed.data.notes),
      space_id: parsed.data.spaceId ?? null,
      preferred_channel: parsed.data.preferredChannel,
    })
    .select("id")
    .single();

  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath("/contatos");
  return ok({ id: data.id });
}

export async function updateContact(
  id: string,
  input: z.input<typeof contactInputSchema>,
): Promise<Result<null>> {
  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.", parsed.error.flatten().fieldErrors);

  const { supabase, user } = await requireOwner();

  let phoneE164: string | null = null;
  if (parsed.data.phone?.trim()) {
    phoneE164 = normalizePhoneToE164(parsed.data.phone);
    if (!phoneE164) return fail("Telefone inválido.", { phone: ["Telefone inválido."] });
  }

  const { error } = await supabase
    .from("contacts")
    .update({
      name: parsed.data.name,
      nickname: toNullable(parsed.data.nickname),
      relationship: parsed.data.relationship,
      company: toNullable(parsed.data.company),
      role: toNullable(parsed.data.role),
      phone_e164: phoneE164,
      email: toNullable(parsed.data.email),
      birthday: toNullable(parsed.data.birthday),
      address: parsed.data.address ?? null,
      notes: toNullable(parsed.data.notes),
      space_id: parsed.data.spaceId ?? null,
      preferred_channel: parsed.data.preferredChannel,
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/contatos");
  revalidatePath(`/contatos/${id}`);
  return ok(null);
}

export async function archiveContact(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("contacts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) return fail("Não foi possível arquivar o contato.");

  revalidatePath("/contatos");
  return ok(null);
}

/**
 * "Consentimento: marcar opt-in exige escolher a origem" (3.3). Desligar os
 * dois canais limpa `consent_source`/`consent_at` — o contato deixa de ter
 * um consentimento registrado. `consent_at` é sempre a data deste salvamento
 * enquanto pelo menos um canal estiver ligado (sem histórico de quando cada
 * canal foi ligado individualmente — simples o bastante pro uso pessoal).
 */
export async function setConsent(input: z.input<typeof consentInputSchema>): Promise<Result<null>> {
  const parsed = consentInputSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");

  const optingIn = parsed.data.whatsappOptIn || parsed.data.emailOptIn;
  if (optingIn && !parsed.data.consentSource) {
    return fail("Escolha a origem do consentimento.", { consentSource: ["Escolha a origem do consentimento."] });
  }

  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("contacts")
    .update({
      whatsapp_opt_in: parsed.data.whatsappOptIn,
      email_opt_in: parsed.data.emailOptIn,
      consent_source: optingIn ? parsed.data.consentSource : null,
      consent_at: optingIn ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.contactId)
    .eq("owner_id", user.id);

  if (error) return fail("Não foi possível salvar o consentimento.");

  revalidatePath(`/contatos/${parsed.data.contactId}`);
  return ok(null);
}

const MERGEABLE_COLUMNS = "nickname, company, role, phone_e164, email, birthday, address, notes, avatar_path, space_id";

/**
 * "Mesclar dois contatos (move vínculos e mantém o mais completo)" (3.3). O
 * dono escolhe `keepId`; `discardId` é apagado no fim, depois de mover tudo
 * que apontava pra ele.
 */
export async function mergeContacts(keepId: string, discardId: string): Promise<Result<null>> {
  if (keepId === discardId) return fail("Escolha dois contatos diferentes pra mesclar.");

  const { supabase, user } = await requireOwner();

  const [{ data: keep, error: keepError }, { data: discard, error: discardError }] = await Promise.all([
    supabase.from("contacts").select(MERGEABLE_COLUMNS).eq("id", keepId).maybeSingle(),
    supabase.from("contacts").select(MERGEABLE_COLUMNS).eq("id", discardId).maybeSingle(),
  ]);
  if (keepError || discardError || !keep || !discard) return fail("Contato não encontrado.");

  const merged = mergeContactFields(keep as unknown as MergeableContact, discard as unknown as MergeableContact);
  if (Object.keys(merged).length > 0) {
    const { error } = await supabase
      .from("contacts")
      .update({ ...merged, address: merged.address as unknown as Json | undefined })
      .eq("id", keepId);
    if (error) return fail("Não foi possível mesclar os contatos.");
  }

  const { data: linkedItems } = await supabase.from("item_contacts").select("item_id, role").eq("contact_id", discardId);
  if (linkedItems && linkedItems.length > 0) {
    await supabase
      .from("item_contacts")
      .upsert(
        linkedItems.map((row) => ({ item_id: row.item_id, contact_id: keepId, owner_id: user.id, role: row.role })),
        { onConflict: "item_id,contact_id", ignoreDuplicates: true },
      );
  }
  await supabase.from("item_contacts").delete().eq("contact_id", discardId);

  await supabase.from("reminder_deliveries").update({ contact_id: keepId }).eq("contact_id", discardId);
  await supabase.from("share_links").update({ contact_id: keepId }).eq("contact_id", discardId);

  const { data: affectedReminders } = await supabase
    .from("reminders")
    .select("id, contact_ids")
    .contains("contact_ids", [discardId]);
  for (const reminder of affectedReminders ?? []) {
    const nextIds = [...new Set(reminder.contact_ids.map((id: string) => (id === discardId ? keepId : id)))];
    await supabase.from("reminders").update({ contact_ids: nextIds }).eq("id", reminder.id);
  }

  const { error: deleteError } = await supabase.from("contacts").delete().eq("id", discardId).eq("owner_id", user.id);
  if (deleteError) return fail("Vínculos movidos, mas não foi possível remover o contato duplicado.");

  revalidatePath("/contatos");
  revalidatePath(`/contatos/${keepId}`);
  return ok(null);
}

export interface ImportSummary {
  created: number;
  skipped: { name: string; existingId: string; existingName: string }[];
}

async function importParsedContacts(
  supabase: Awaited<ReturnType<typeof requireOwner>>["supabase"],
  ownerId: string,
  spaceId: string | null,
  contacts: { name: string; phone: string | null; email: string | null; company?: string | null; role?: string | null; birthday?: string | null; notes?: string | null }[],
): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, skipped: [] };

  for (const contact of contacts) {
    const phoneE164 = contact.phone ? normalizePhoneToE164(contact.phone) : null;
    const email = contact.email?.trim() || null;

    const duplicates = await findDuplicateContacts(supabase, { phoneE164, email });
    if (duplicates.length > 0) {
      summary.skipped.push({ name: contact.name, existingId: duplicates[0]!.id, existingName: duplicates[0]!.name });
      continue;
    }

    const { error } = await supabase.from("contacts").insert({
      owner_id: ownerId,
      name: contact.name,
      relationship: "other",
      preferred_channel: "whatsapp",
      phone_e164: phoneE164,
      email,
      company: contact.company ?? null,
      role: contact.role ?? null,
      birthday: contact.birthday ?? null,
      notes: contact.notes ?? null,
      space_id: spaceId,
    });
    if (!error) summary.created++;
  }

  return summary;
}

/** Importação de vCard (`.vcf`, 3.3) — Google Contatos/iPhone. */
export async function importVCardContacts(vcfText: string, spaceId: string | null): Promise<Result<ImportSummary>> {
  const { supabase, user } = await requireOwner();

  const parsed = parseVCard(vcfText);
  if (parsed.length === 0) return fail("Nenhum contato encontrado no arquivo.");

  const summary = await importParsedContacts(
    supabase,
    user.id,
    spaceId,
    parsed.map((c) => ({ name: c.name, phone: c.phones[0] ?? null, email: c.emails[0] ?? null, company: c.company, role: c.role, birthday: c.birthday, notes: c.notes })),
  );

  revalidatePath("/contatos");
  return ok(summary);
}

const csvImportInputSchema = z.object({
  rows: z.array(z.array(z.string())),
  mapping: z.record(z.string(), z.enum(csvColumnKeys)),
  spaceId: z.string().uuid().nullable(),
});

/** Importação de CSV com mapeamento de colunas (3.3) — `mapping` é índice de coluna (string) → chave do contato. */
export async function importCsvContacts(input: z.input<typeof csvImportInputSchema>): Promise<Result<ImportSummary>> {
  const parsed = csvImportInputSchema.safeParse(input);
  if (!parsed.success) return fail("Dados de importação inválidos.");

  const { supabase, user } = await requireOwner();

  const columnByKey = new Map<CsvColumnKey, number>();
  for (const [indexStr, key] of Object.entries(parsed.data.mapping)) {
    if (key !== "ignore") columnByKey.set(key, Number(indexStr));
  }
  const nameColumn = columnByKey.get("name");
  if (nameColumn === undefined) return fail("Mapeie ao menos a coluna do nome.");

  const contacts = parsed.data.rows
    .map((row) => ({
      name: row[nameColumn]?.trim() ?? "",
      phone: columnByKey.has("phone") ? (row[columnByKey.get("phone")!] ?? null) : null,
      email: columnByKey.has("email") ? (row[columnByKey.get("email")!] ?? null) : null,
      company: columnByKey.has("company") ? (row[columnByKey.get("company")!] ?? null) : null,
      role: columnByKey.has("role") ? (row[columnByKey.get("role")!] ?? null) : null,
      birthday: columnByKey.has("birthday") ? (row[columnByKey.get("birthday")!] ?? null) : null,
      notes: columnByKey.has("notes") ? (row[columnByKey.get("notes")!] ?? null) : null,
    }))
    .filter((c) => c.name);

  if (contacts.length === 0) return fail("Nenhuma linha com nome preenchido.");

  const summary = await importParsedContacts(supabase, user.id, parsed.data.spaceId, contacts);

  revalidatePath("/contatos");
  return ok(summary);
}

/** Busca pro menu `@` de menção de contatos no editor (3.3, `contact-mention-suggestion.ts`). */
export async function searchContactsForMention(query: string): Promise<{ id: string; name: string }[]> {
  const { supabase } = await requireOwner();
  return searchContactsForMentionQuery(supabase, query);
}

/** Busca de convidados pro diálogo de criar/editar evento (3.6). */
export async function searchContactsForAttendees(query: string): Promise<ContactAttendeeResult[]> {
  const { supabase } = await requireOwner();
  return searchContactsForAttendeesQuery(supabase, query);
}

/** Lista filtrada de `/contatos` (3.3) — chamada pelo cliente a cada mudança de busca/filtro. */
export async function searchContacts(filters: ContactFilters): Promise<ContactRow[]> {
  const { supabase } = await requireOwner();
  return listContacts(supabase, filters);
}
