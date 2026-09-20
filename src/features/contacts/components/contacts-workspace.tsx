"use client";

import Link from "next/link";
import { Upload, UserPlus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import type { SidebarSpace } from "@/features/spaces/queries";
import { searchContacts } from "../actions";
import type { ContactRow } from "../queries";
import { RELATIONSHIPS, RELATIONSHIP_LABELS } from "../schemas";
import { ContactForm } from "./contact-form";
import { ImportCsvDialog } from "./import-csv-dialog";
import { ImportVCardDialog } from "./import-vcard-dialog";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

/** Página `/contatos` (3.3): busca + filtros, criar, importar vCard/CSV. */
export function ContactsWorkspace({ spaces, initialContacts }: { spaces: SidebarSpace[]; initialContacts: ContactRow[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [relationship, setRelationship] = useState("");
  const [company, setCompany] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [optIn, setOptIn] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showVCard, setShowVCard] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const timeout = setTimeout(() => {
      startTransition(async () => {
        const result = await searchContacts({
          search: search || undefined,
          relationship: (relationship || undefined) as (typeof RELATIONSHIPS)[number] | undefined,
          company: company || undefined,
          spaceId: spaceId || undefined,
          optIn: optIn === "" ? undefined : optIn === "true",
        });
        setContacts(result);
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, relationship, company, spaceId, optIn]);

  function refresh() {
    startTransition(async () => {
      const result = await searchContacts({});
      setContacts(result);
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Contatos</h1>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowVCard(true)} className="flex items-center gap-1.5 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
            <Upload className="h-4 w-4" /> vCard
          </button>
          <button type="button" onClick={() => setShowCsv(true)} className="flex items-center gap-1.5 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
            <Upload className="h-4 w-4" /> CSV
          </button>
          <button type="button" onClick={() => setShowForm(true)} className="bg-foreground text-background flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium">
            <UserPlus className="h-4 w-4" /> Novo contato
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
          <ContactForm
            spaces={spaces}
            onSaved={() => {
              setShowForm(false);
              refresh();
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, e-mail, telefone…" className={`${inputClassName} min-w-48 flex-1`} />
        <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className={inputClassName}>
          <option value="">Toda relação</option>
          {RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>
          ))}
        </select>
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa" className={inputClassName} />
        <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className={inputClassName}>
          <option value="">Todo espaço</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>{space.name}</option>
          ))}
        </select>
        <select value={optIn} onChange={(e) => setOptIn(e.target.value)} className={inputClassName}>
          <option value="">Opt-in: todos</option>
          <option value="true">Com opt-in</option>
          <option value="false">Sem opt-in</option>
        </select>
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum contato encontrado.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <Link
                href={`/contatos/${contact.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm hover:bg-black/[.02] dark:border-white/[.08] dark:hover:bg-white/[.03]"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-black dark:text-zinc-50">{contact.name}</span>
                  <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {[RELATIONSHIP_LABELS[contact.relationship as (typeof RELATIONSHIPS)[number]] ?? contact.relationship, contact.company].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{contact.phoneE164 ?? contact.email ?? ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showVCard && <ImportVCardDialog spaces={spaces} onClose={() => setShowVCard(false)} onImported={refresh} />}
      {showCsv && <ImportCsvDialog spaces={spaces} onClose={() => setShowCsv(false)} onImported={refresh} />}
    </div>
  );
}
