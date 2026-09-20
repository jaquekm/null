export interface ParsedVCardContact {
  name: string;
  phones: string[];
  emails: string[];
  company: string | null;
  role: string | null;
  birthday: string | null; // "YYYY-MM-DD"
  notes: string | null;
}

/** Desdobra "quoted-printable"/linhas continuadas (RFC 6350: linha seguinte começando com espaço/tab é continuação). */
function unfoldLines(text: string): string[] {
  const rawLines = text.split(/\r\n|\r|\n/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** `KEY;PARAM=valor;PARAM2=valor2:VALOR` → { key, value } (ignora os parâmetros — não precisamos de TYPE=CELL etc. pra extrair o dado). */
function splitLine(line: string): { key: string; value: string } | null {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return null;
  const rawKey = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1).trim();
  const key = (rawKey.split(";")[0] ?? "").toUpperCase();
  return { key, value };
}

/** BDAY costuma vir como "19900115" ou "1990-01-15" (vCard 3/4) — normaliza pro formato `date` do banco. */
function normalizeBirthday(value: string): string | null {
  const digitsOnly = value.replace(/[^0-9]/g, "");
  if (digitsOnly.length !== 8) return null;
  return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 6)}-${digitsOnly.slice(6, 8)}`;
}

/**
 * Parser de vCard (3.3) — cobre os campos que o formulário de contato usa
 * (`FN`, `TEL`, `EMAIL`, `ORG`, `TITLE`, `BDAY`, `NOTE`). Não tenta ser um
 * parser completo do RFC 6350 (grupos, `X-` proprietários, `PHOTO` embutida
 * etc.) — só o suficiente pra importar de exportações comuns do Google
 * Contatos/iPhone.
 */
export function parseVCard(text: string): ParsedVCardContact[] {
  const lines = unfoldLines(text);
  const contacts: ParsedVCardContact[] = [];
  let current: ParsedVCardContact | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase() === "BEGIN:VCARD") {
      current = { name: "", phones: [], emails: [], company: null, role: null, birthday: null, notes: null };
      continue;
    }
    if (trimmed.toUpperCase() === "END:VCARD") {
      if (current && current.name) contacts.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const parsed = splitLine(trimmed);
    if (!parsed) continue;
    const { key, value } = parsed;
    if (!value) continue;

    switch (key) {
      case "FN":
        current.name = value;
        break;
      case "N":
        if (!current.name) {
          // "Sobrenome;Nome;;;" → "Nome Sobrenome"
          const [last, first] = value.split(";");
          current.name = [first, last].filter(Boolean).join(" ").trim();
        }
        break;
      case "TEL":
        current.phones.push(value);
        break;
      case "EMAIL":
        current.emails.push(value);
        break;
      case "ORG":
        current.company = value.split(";")[0] ?? value;
        break;
      case "TITLE":
        current.role = value;
        break;
      case "BDAY":
        current.birthday = normalizeBirthday(value);
        break;
      case "NOTE":
        current.notes = value;
        break;
      default:
        break;
    }
  }

  return contacts;
}
