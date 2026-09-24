import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/**
 * Dump de tudo que o Hub sabe sobre um contato (7.7, LGPD: "tela para
 * exportar... os dados de um contato a pedido") — um JSON só, pra entregar
 * a quem pediu. Cada seção é uma tabela que referencia esse contato de
 * algum jeito. `reminders.contact_ids` é array (um lembrete pode ter vários
 * destinatários), por isso `.contains()` em vez de `.eq()`.
 */
export async function getContactExportData(admin: Client, ownerId: string, contactId: string): Promise<Record<string, unknown> | null> {
  const { data: contact } = await admin.from("contacts").select("*").eq("id", contactId).eq("owner_id", ownerId).maybeSingle();
  if (!contact) return null;

  const [meetings, reminders, deliveries, transactions, bills, splitsPaidBy, splitShares, shareLinks] = await Promise.all([
    admin.from("item_contacts").select("item_id, role, items(title)").eq("contact_id", contactId),
    admin.from("reminders").select("id, title, send_at, status, contact_ids").eq("owner_id", ownerId).contains("contact_ids", [contactId]),
    admin.from("reminder_deliveries").select("occurrence_at, channel, destination, rendered_message, status").eq("owner_id", ownerId).eq("contact_id", contactId),
    admin.from("fin_transactions").select("id, description, amount_cents, occurred_on").eq("owner_id", ownerId).eq("contact_id", contactId),
    admin.from("fin_bills").select("id, description, amount_cents, due_on, direction, status").eq("owner_id", ownerId).eq("contact_id", contactId),
    admin.from("fin_splits").select("id, title, total_cents, occurred_on").eq("owner_id", ownerId).eq("paid_by_contact_id", contactId),
    admin.from("fin_split_shares").select("id, split_id, share_cents, settled_cents").eq("contact_id", contactId),
    admin.from("share_links").select("id, resource_type, permission, created_at, expires_at").eq("owner_id", ownerId).eq("contact_id", contactId),
  ]);

  return {
    contato: contact,
    reunioes: meetings.data ?? [],
    lembretes: reminders.data ?? [],
    entregas_de_mensagem: deliveries.data ?? [],
    lancamentos_financeiros: transactions.data ?? [],
    contas: bills.data ?? [],
    divisoes_pagas_por: splitsPaidBy.data ?? [],
    partes_de_divisao: splitShares.data ?? [],
    links_compartilhados: shareLinks.data ?? [],
  };
}

/**
 * Exclusão definitiva de um contato (7.7, LGPD). O que a própria FK já
 * resolve sozinha (não precisa de código aqui): `item_contacts`/
 * `fin_split_shares` (`on delete cascade`) somem junto; `share_links`/
 * `fin_transactions`/`fin_bills`/`fin_splits.paid_by_contact_id`
 * (`on delete set null`) ficam órfãos de propósito — nenhuma dessas tabelas
 * guarda o *nome* do contato como texto solto, só o id, então nulificar o
 * vínculo já é "anonimizar" pra elas: o registro financeiro continua
 * existindo (descrição, valor, data), só sem mais apontar pra ninguém.
 *
 * O que a FK **não** resolve, e por isso é feito aqui antes de apagar a
 * linha do contato:
 * - `reminders.contact_ids` é `uuid[]`, não uma FK de verdade — o Postgres
 *   não limpa isso sozinho quando o contato some, então um id órfão ficaria
 *   pra sempre num lembrete de outra pessoa (achado ao ler o schema com
 *   calma, não assumido). Remove o id do array de cada lembrete que o tiver.
 * - `reminder_deliveries` guarda `destination` (telefone/e-mail) e
 *   `rendered_message` (o texto de verdade que foi enviado) — dado pessoal
 *   em texto puro, não só um vínculo — por isso é apagado de vez, não só
 *   desvinculado.
 */
export async function deleteContactPermanently(admin: Client, ownerId: string, contactId: string): Promise<void> {
  const { data: remindersWithContact } = await admin.from("reminders").select("id, contact_ids").eq("owner_id", ownerId).contains("contact_ids", [contactId]);
  for (const reminder of remindersWithContact ?? []) {
    const remaining = reminder.contact_ids.filter((id) => id !== contactId);
    await admin.from("reminders").update({ contact_ids: remaining }).eq("id", reminder.id);
  }

  await admin.from("reminder_deliveries").delete().eq("owner_id", ownerId).eq("contact_id", contactId);

  const { data: contact } = await admin.from("contacts").select("avatar_path").eq("id", contactId).eq("owner_id", ownerId).maybeSingle();
  if (contact?.avatar_path) {
    await admin.storage.from("attachments").remove([contact.avatar_path]);
  }

  await admin.from("contacts").delete().eq("id", contactId).eq("owner_id", ownerId);
}
