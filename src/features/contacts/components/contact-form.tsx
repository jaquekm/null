"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { SidebarSpace } from "@/features/spaces/queries";
import { createContact, updateContact } from "../actions";
import { RELATIONSHIP_LABELS, RELATIONSHIPS } from "../schemas";
import type { ContactDetailRow } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

interface ContactFormProps {
  spaces: SidebarSpace[];
  contact?: ContactDetailRow;
  onSaved?: (id: string) => void;
  onCancel?: () => void;
}

/** Formulário de criar/editar contato (3.3) — mesmo componente pros dois casos, diferenciado por `contact` estar presente. */
export function ContactForm({ spaces, contact, onSaved, onCancel }: ContactFormProps) {
  const [name, setName] = useState(contact?.name ?? "");
  const [nickname, setNickname] = useState(contact?.nickname ?? "");
  const [relationship, setRelationship] = useState(contact?.relationship ?? "other");
  const [company, setCompany] = useState(contact?.company ?? "");
  const [role, setRole] = useState(contact?.role ?? "");
  const [phone, setPhone] = useState(contact?.phoneE164 ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [birthday, setBirthday] = useState(contact?.birthday ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [spaceId, setSpaceId] = useState(contact?.spaceId ?? "");
  const [preferredChannel, setPreferredChannel] = useState(contact?.preferredChannel ?? "whatsapp");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setFieldErrors({});
    const input = {
      name,
      nickname,
      relationship: relationship as (typeof RELATIONSHIPS)[number],
      company,
      role,
      phone,
      email,
      birthday,
      notes,
      spaceId: spaceId || null,
      preferredChannel: preferredChannel as "whatsapp" | "email",
    };

    startTransition(async () => {
      if (contact) {
        const result = await updateContact(contact.id, input);
        if (!result.ok) {
          toast.error(result.error);
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
          return;
        }
        toast.success("Contato atualizado.");
        onSaved?.(contact.id);
        return;
      }

      const result = await createContact(input);
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success("Contato criado.");
      onSaved?.(result.data.id);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Nome*
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} disabled={pending} />
          {fieldErrors.name && <span className="text-red-500">{fieldErrors.name[0]}</span>}
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Apelido
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} className={inputClassName} disabled={pending} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Relação
          <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className={inputClassName} disabled={pending}>
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {RELATIONSHIP_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Espaço
          <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className={inputClassName} disabled={pending}>
            <option value="">Nenhum</option>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Empresa
          <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputClassName} disabled={pending} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Cargo
          <input value={role} onChange={(e) => setRole(e.target.value)} className={inputClassName} disabled={pending} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Telefone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 98765-4321"
            className={inputClassName}
            disabled={pending}
          />
          {fieldErrors.phone && <span className="text-red-500">{fieldErrors.phone[0]}</span>}
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClassName} disabled={pending} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Aniversário
          <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className={inputClassName} disabled={pending} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Canal preferido
          <select
            value={preferredChannel}
            onChange={(e) => setPreferredChannel(e.target.value)}
            className={inputClassName}
            disabled={pending}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">E-mail</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Notas
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${inputClassName} w-full`} disabled={pending} />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !name.trim()}
          className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Salvando..." : contact ? "Salvar" : "Criar contato"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={pending} className="self-start rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
