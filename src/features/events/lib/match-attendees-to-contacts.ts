interface AttendeeLike {
  email: string;
}

interface ContactLike {
  id: string;
  email: string | null;
}

/** Casa e-mails de participantes do evento com contatos existentes (3.5), sem acento/maiúscula importar. */
export function matchAttendeesToContactIds(attendees: AttendeeLike[], contacts: ContactLike[]): string[] {
  const idByEmail = new Map<string, string>();
  for (const contact of contacts) {
    if (contact.email) idByEmail.set(contact.email.trim().toLowerCase(), contact.id);
  }

  const matched = new Set<string>();
  for (const attendee of attendees) {
    const id = idByEmail.get(attendee.email.trim().toLowerCase());
    if (id) matched.add(id);
  }
  return [...matched];
}
