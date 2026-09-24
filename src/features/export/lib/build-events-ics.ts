export interface EventForIcs {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  status: "confirmed" | "tentative" | "cancelled";
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Dobra linhas com mais de 75 octetos (RFC 5545) — continuação começa com um espaço. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return parts.join("\r\n");
}

function toIcsDateUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function toIcsDateOnly(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

const STATUS_MAP: Record<EventForIcs["status"], string> = { confirmed: "CONFIRMED", tentative: "TENTATIVE", cancelled: "CANCELLED" };

function buildEventBlock(event: EventForIcs): string[] {
  const lines: string[] = ["BEGIN:VEVENT", `UID:${event.id}@hub`];
  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${toIcsDateOnly(event.startsAt)}`);
    lines.push(`DTEND;VALUE=DATE:${toIcsDateOnly(event.endsAt)}`);
  } else {
    lines.push(`DTSTART:${toIcsDateUtc(event.startsAt)}`);
    lines.push(`DTEND:${toIcsDateUtc(event.endsAt)}`);
  }
  lines.push(`SUMMARY:${icsEscape(event.title)}`);
  if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
  if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
  lines.push(`STATUS:${STATUS_MAP[event.status]}`);
  lines.push("END:VEVENT");
  return lines;
}

/** `agenda/eventos.ics` (7.4) — um `VCALENDAR` com um `VEVENT` por evento; sem `RRULE` (a recorrência já vem materializada, um evento por ocorrência, mesma convenção da sincronização com o Google Calendar). */
export function buildEventsIcs(events: EventForIcs[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hub//Export//PT-BR", ...events.flatMap(buildEventBlock), "END:VCALENDAR"];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
