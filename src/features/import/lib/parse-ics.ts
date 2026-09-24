export interface ParsedIcsEvent {
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  status: "confirmed" | "tentative" | "cancelled";
}

/** Desdobra linhas continuadas (RFC 5545: linha seguinte começando com espaço/tab é continuação da anterior) — mesma regra do parser de vCard (3.3). */
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

function unescapeIcsText(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

interface SplitLine {
  key: string;
  params: Record<string, string>;
  value: string;
}

function splitLine(line: string): SplitLine | null {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return null;
  const rawKey = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const [key, ...paramParts] = rawKey.split(";");

  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const [paramKey, paramValue] = part.split("=");
    if (paramKey && paramValue) params[paramKey.toUpperCase()] = paramValue;
  }
  return { key: (key ?? "").toUpperCase(), params, value };
}

function parseIcsDate(value: string, params: Record<string, string>): { iso: string; allDay: boolean } | null {
  const v = value.trim();

  if (params.VALUE === "DATE" || /^\d{8}$/.test(v)) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
    if (!m) return null;
    const [, y, mo, d] = m;
    return { iso: new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).toISOString(), allDay: true };
  }

  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  // Sem "Z" nem `TZID` resolvido: aproxima pelo fuso do processo — aceitável pra um import de histórico "somente leitura" (7.5), não pra sincronização de verdade.
  const date = z
    ? new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)))
    : new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  return Number.isNaN(date.getTime()) ? null : { iso: date.toISOString(), allDay: false };
}

const STATUS_MAP: Record<string, ParsedIcsEvent["status"]> = { CONFIRMED: "confirmed", TENTATIVE: "tentative", CANCELLED: "cancelled" };

interface RawEvent {
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  dtstart?: { value: string; params: Record<string, string> };
  dtend?: { value: string; params: Record<string, string> };
}

function finalizeEvent(raw: RawEvent, warnings: string[]): ParsedIcsEvent | null {
  const label = raw.summary?.trim() || "(sem título)";
  if (!raw.dtstart) {
    warnings.push(`Evento "${label}" sem DTSTART — ignorado.`);
    return null;
  }
  const start = parseIcsDate(raw.dtstart.value, raw.dtstart.params);
  if (!start) {
    warnings.push(`Não consegui interpretar a data de "${label}" — ignorado.`);
    return null;
  }
  const end = raw.dtend ? parseIcsDate(raw.dtend.value, raw.dtend.params) : null;

  return {
    title: label,
    description: raw.description ? unescapeIcsText(raw.description) : null,
    location: raw.location ? unescapeIcsText(raw.location) : null,
    startsAt: start.iso,
    endsAt: end?.iso ?? start.iso,
    allDay: start.allDay,
    status: STATUS_MAP[raw.status ?? ""] ?? "confirmed",
  };
}

/**
 * `.ics` (7.5, "eventos antigos para histórico, somente leitura") →
 * `ParsedIcsEvent[]`. Sem `RRULE`/recorrência (cada `VEVENT` do arquivo já é
 * uma ocorrência materializada, igual ao que a sincronização com o Google
 * Calendar grava) e sem `TZID` de verdade — histórico antigo não precisa de
 * exatidão de fuso ao segundo.
 */
export function parseIcsEvents(icsText: string): { events: ParsedIcsEvent[]; warnings: string[] } {
  const lines = unfoldLines(icsText);
  const events: ParsedIcsEvent[] = [];
  const warnings: string[] = [];
  let current: RawEvent | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.toUpperCase() === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line.toUpperCase() === "END:VEVENT") {
      if (current) {
        const finalized = finalizeEvent(current, warnings);
        if (finalized) events.push(finalized);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const parsed = splitLine(line);
    if (!parsed || !parsed.value) continue;

    switch (parsed.key) {
      case "SUMMARY":
        current.summary = unescapeIcsText(parsed.value);
        break;
      case "DESCRIPTION":
        current.description = parsed.value;
        break;
      case "LOCATION":
        current.location = parsed.value;
        break;
      case "STATUS":
        current.status = parsed.value.trim().toUpperCase();
        break;
      case "DTSTART":
        current.dtstart = { value: parsed.value, params: parsed.params };
        break;
      case "DTEND":
        current.dtend = { value: parsed.value, params: parsed.params };
        break;
    }
  }

  if (events.length === 0 && warnings.length === 0) warnings.push("Nenhum evento (VEVENT) encontrado no arquivo .ics.");
  return { events, warnings };
}
