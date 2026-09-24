import { buildCsv } from "./csv";

export interface ContactForExport {
  name: string;
  nickname: string | null;
  relationship: string;
  company: string | null;
  role: string | null;
  phoneE164: string | null;
  email: string | null;
  birthday: string | null;
  spaceName: string | null;
  notes: string | null;
}

const HEADER = ["Nome", "Apelido", "Relacionamento", "Empresa", "Cargo", "Telefone", "E-mail", "Aniversário", "Espaço", "Notas"];

export function buildContactsCsv(contacts: ContactForExport[]): string {
  return buildCsv(
    HEADER,
    contacts.map((c) => [
      c.name,
      c.nickname ?? "",
      c.relationship,
      c.company ?? "",
      c.role ?? "",
      c.phoneE164 ?? "",
      c.email ?? "",
      c.birthday ?? "",
      c.spaceName ?? "",
      c.notes ?? "",
    ]),
  );
}

/** Escapa `,` `;` `\` e quebra de linha conforme RFC 6350 (vCard 3.0). */
function vcardEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function vcardBirthday(birthday: string): string {
  return birthday.replace(/-/g, "");
}

/** vCard 3.0 de um contato — mesmos campos que `parseVCard` (3.3) sabe ler de volta. */
export function buildContactVCard(contact: ContactForExport): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vcardEscape(contact.name)}`, `N:${vcardEscape(contact.name)};;;;`];
  if (contact.company) lines.push(`ORG:${vcardEscape(contact.company)}`);
  if (contact.role) lines.push(`TITLE:${vcardEscape(contact.role)}`);
  if (contact.phoneE164) lines.push(`TEL;TYPE=CELL:${contact.phoneE164}`);
  if (contact.email) lines.push(`EMAIL:${vcardEscape(contact.email)}`);
  if (contact.birthday) lines.push(`BDAY:${vcardBirthday(contact.birthday)}`);
  if (contact.notes) lines.push(`NOTE:${vcardEscape(contact.notes)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

export function buildContactsVCard(contacts: ContactForExport[]): string {
  return contacts.map(buildContactVCard).join("\r\n") + "\r\n";
}
