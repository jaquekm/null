import { describe, expect, it } from "vitest";
import { buildEventsIcs, type EventForIcs } from "./build-events-ics";

const baseEvent: EventForIcs = {
  id: "event-1",
  title: "Reunião",
  description: "Pauta: revisão",
  location: "Sala 2",
  startsAt: "2026-03-10T13:00:00.000Z",
  endsAt: "2026-03-10T14:00:00.000Z",
  allDay: false,
  status: "confirmed",
};

describe("buildEventsIcs", () => {
  it("monta um VCALENDAR com um VEVENT por evento", () => {
    const ics = buildEventsIcs([baseEvent]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:event-1@hub");
    expect(ics).toContain("DTSTART:20260310T130000Z");
    expect(ics).toContain("DTEND:20260310T140000Z");
    expect(ics).toContain("SUMMARY:Reunião");
    expect(ics).toContain("DESCRIPTION:Pauta: revisão");
    expect(ics).toContain("LOCATION:Sala 2");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("evento de dia inteiro usa DTSTART/DTEND só com data", () => {
    const ics = buildEventsIcs([{ ...baseEvent, allDay: true, startsAt: "2026-03-10T00:00:00.000Z", endsAt: "2026-03-11T00:00:00.000Z" }]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260310");
    expect(ics).toContain("DTEND;VALUE=DATE:20260311");
  });

  it("escapa vírgula e ponto-e-vírgula no título", () => {
    const ics = buildEventsIcs([{ ...baseEvent, title: "Reunião, 1ª parte; final" }]);
    expect(ics).toContain("SUMMARY:Reunião\\, 1ª parte\\; final");
  });

  it("lista vazia ainda produz um VCALENDAR válido", () => {
    const ics = buildEventsIcs([]);
    expect(ics).toBe("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Hub//Export//PT-BR\r\nEND:VCALENDAR\r\n");
  });
});
