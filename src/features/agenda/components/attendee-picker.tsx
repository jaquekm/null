"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { searchContactsForAttendees } from "@/features/contacts/actions";

interface Attendee {
  email: string;
  name: string;
}

/** Convidados a partir de contatos (3.6) — busca por nome, só contatos com e-mail cadastrado. */
export function AttendeePicker({ attendees, onChange }: { attendees: Attendee[]; onChange: (attendees: Attendee[]) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Attendee[]>([]);

  async function handleSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const found = await searchContactsForAttendees(value);
    setResults(found.filter((contact) => !attendees.some((a) => a.email === contact.email)));
  }

  function addAttendee(contact: Attendee) {
    onChange([...attendees, contact]);
    setQuery("");
    setResults([]);
  }

  function removeAttendee(email: string) {
    onChange(attendees.filter((a) => a.email !== email));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400" htmlFor="attendee-search">
        Convidados
      </label>
      {attendees.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attendees.map((attendee) => (
            <span
              key={attendee.email}
              className="flex items-center gap-1 rounded-full bg-black/[.06] px-2 py-0.5 text-xs text-zinc-700 dark:bg-white/[.08] dark:text-zinc-200"
            >
              {attendee.name}
              <button type="button" onClick={() => removeAttendee(attendee.email)} aria-label={`Remover ${attendee.name}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        id="attendee-search"
        value={query}
        onChange={(e) => void handleSearch(e.target.value)}
        placeholder="Buscar contato pelo nome"
        className="rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.16]"
      />
      {results.length > 0 && (
        <ul className="flex flex-col gap-0.5 rounded-lg border border-black/[.08] dark:border-white/[.08]">
          {results.map((contact) => (
            <li key={contact.email}>
              <button
                type="button"
                onClick={() => addAttendee(contact)}
                className="w-full px-2 py-1.5 text-left text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06]"
              >
                {contact.name} <span className="text-zinc-400">({contact.email})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
