"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ContactFinanceSection } from "@/features/financas/components/contact-finance-section";
import type { ContactFinanceSummary } from "@/features/financas/queries";
import { RemindAboutButton } from "@/features/reminders/components/remind-about-button";
import { ContactSalesSection } from "@/features/sales/components/contact-sales-section";
import type { ContactSalesSummary } from "@/features/sales/queries";
import type { SidebarSpace } from "@/features/spaces/queries";
import { archiveContact, deleteContactPermanently, exportContactData } from "../actions";
import type { ContactActivity, ContactDetailRow } from "../queries";
import { RELATIONSHIP_LABELS, type Relationship } from "../schemas";
import { ConsentSection } from "./consent-section";
import { ContactForm } from "./contact-form";
import { MergeContactsDialog } from "./merge-contacts-dialog";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function ContactDetail({
  spaces,
  contact,
  activity,
  timezone,
  finance,
  sales,
}: {
  spaces: SidebarSpace[];
  contact: ContactDetailRow;
  activity: ContactActivity;
  timezone: string;
  finance: ContactFinanceSummary;
  /** `null` = pack Vendas (CRM, 5.6) não instalado — a seção some inteira. */
  sales: ContactSalesSummary | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleArchive() {
    if (!window.confirm(`Arquivar ${contact.name}?`)) return;
    startTransition(async () => {
      const result = await archiveContact(contact.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Contato arquivado.");
      router.push("/contatos");
    });
  }

  /** Exportação de dados (7.7, LGPD) — baixa um `.json` com tudo que o Hub sabe sobre o contato. */
  function handleExport() {
    startTransition(async () => {
      const result = await exportContactData(contact.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const blob = new Blob([result.data.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.data.fileName;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  /** Exclusão definitiva (7.7, LGPD) — irreversível, por isso pede o nome digitado, não só um confirm(). */
  function handleDeletePermanently() {
    const typed = window.prompt(`Isso apaga o contato "${contact.name}" pra sempre, sem volta. Digite o nome exatamente igual pra confirmar:`);
    if (typed !== contact.name) {
      if (typed !== null) toast.error("Nome não bateu — nada foi excluído.");
      return;
    }
    startTransition(async () => {
      const result = await deleteContactPermanently(contact.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Contato excluído definitivamente.");
      router.push("/contatos");
    });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link href="/contatos" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        ← Contatos
      </Link>

      {editing ? (
        <div className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
          <ContactForm spaces={spaces} contact={contact} onSaved={() => { setEditing(false); router.refresh(); }} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{contact.name}</h1>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-black/[.12] px-3 py-1.5 text-xs dark:border-white/[.16]">
                Editar
              </button>
              <button type="button" onClick={() => setShowMerge(true)} className="rounded-full border border-black/[.12] px-3 py-1.5 text-xs dark:border-white/[.16]">
                Mesclar
              </button>
              <button type="button" onClick={handleArchive} disabled={pending} className="rounded-full border border-black/[.12] px-3 py-1.5 text-xs text-red-600 disabled:opacity-60 dark:border-white/[.16]">
                Arquivar
              </button>
              <button type="button" onClick={handleExport} disabled={pending} className="rounded-full border border-black/[.12] px-3 py-1.5 text-xs disabled:opacity-60 dark:border-white/[.16]">
                Exportar dados
              </button>
              <button
                type="button"
                onClick={handleDeletePermanently}
                disabled={pending}
                className="rounded-full border border-red-600/40 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-60 dark:border-red-400/40 dark:text-red-400"
              >
                Excluir definitivamente
              </button>
            </div>
          </div>
          <RemindAboutButton
            defaultTitle={`Lembrete para ${contact.name}`}
            defaultTimezone={timezone}
            defaultRecipientType="contacts"
            defaultContactIds={[contact.id]}
            sourceType="contact"
            sourceId={contact.id}
          />
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <Field label="Relação" value={RELATIONSHIP_LABELS[contact.relationship as Relationship] ?? contact.relationship} />
            <Field label="Apelido" value={contact.nickname} />
            <Field label="Empresa" value={contact.company} />
            <Field label="Cargo" value={contact.role} />
            <Field label="Telefone" value={contact.phoneE164} />
            <Field label="E-mail" value={contact.email} />
            <Field label="Aniversário" value={contact.birthday ? formatDate(contact.birthday) : null} />
          </dl>
          {contact.notes && <p className="text-sm whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">{contact.notes}</p>}
        </div>
      )}

      <ConsentSection contact={contact} />

      <Section title="Finanças">
        <ContactFinanceSection finance={finance} />
      </Section>

      {sales && (
        <Section title="Vendas">
          <ContactSalesSection sales={sales} />
        </Section>
      )}

      <Section title="Itens ligados">
        {activity.linkedItems.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex flex-col gap-1">
            {activity.linkedItems.map((item) => (
              <li key={item.id}>
                <Link href={`/itens/${item.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm hover:bg-black/[.02] dark:border-white/[.08] dark:hover:bg-white/[.03]">
                  <span className="truncate">{item.title}</span>
                  <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{item.typeName ?? ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Eventos">
        {activity.events.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex flex-col gap-1">
            {activity.events.map((event) => (
              <li key={event.id} className="rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
                {event.title} — {formatDate(event.startsAt)}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Lembretes">
        {activity.reminders.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex flex-col gap-1">
            {activity.reminders.map((reminder) => (
              <li key={reminder.id} className="rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
                {reminder.title} — {formatDate(reminder.sendAt)}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Histórico de mensagens">
        {activity.deliveries.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex flex-col gap-1">
            {activity.deliveries.map((delivery) => (
              <li key={delivery.id} className="flex flex-col gap-0.5 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {delivery.channel} · {delivery.status} · {formatDate(delivery.occurrenceAt)}
                </span>
                <span className="truncate">{delivery.renderedMessage}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {showMerge && <MergeContactsDialog contactId={contact.id} contactName={contact.name} onClose={() => setShowMerge(false)} />}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-zinc-400 dark:text-zinc-500">{label}</dt>
      <dd className="text-black dark:text-zinc-50">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-zinc-400 dark:text-zinc-500">Nada por aqui ainda.</p>;
}
