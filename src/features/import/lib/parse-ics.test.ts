import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseIcsEvents } from "./parse-ics";

const fixture = readFileSync(path.join(process.cwd(), "tests/fixtures/import/sample.ics"), "utf-8");

describe("parseIcsEvents", () => {
  it("lê os dois VEVENT do fixture", () => {
    const { events, warnings } = parseIcsEvents(fixture);
    expect(warnings).toEqual([]);
    expect(events).toHaveLength(2);

    const [meeting, holiday] = events;
    expect(meeting).toMatchObject({
      title: "Reunião de alinhamento",
      description: "Pauta: revisão de metas, com o time",
      location: "Sala 2",
      startsAt: "2026-03-10T13:00:00.000Z",
      endsAt: "2026-03-10T14:00:00.000Z",
      allDay: false,
      status: "confirmed",
    });
    expect(holiday).toMatchObject({ title: "Feriado", allDay: true, status: "tentative", startsAt: "2026-04-01T00:00:00.000Z", endsAt: "2026-04-02T00:00:00.000Z" });
  });

  it("evento sem DTSTART é ignorado, com aviso", () => {
    const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "SUMMARY:Sem data", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const { events, warnings } = parseIcsEvents(ics);
    expect(events).toEqual([]);
    expect(warnings[0]).toContain("Sem data");
  });

  it("sem nenhum VEVENT: aviso genérico", () => {
    const { events, warnings } = parseIcsEvents("BEGIN:VCALENDAR\r\nEND:VCALENDAR");
    expect(events).toEqual([]);
    expect(warnings).toEqual(["Nenhum evento (VEVENT) encontrado no arquivo .ics."]);
  });

  it("sem DTEND: usa o mesmo horário do DTSTART", () => {
    const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "SUMMARY:Só início", "DTSTART:20260501T100000Z", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const { events } = parseIcsEvents(ics);
    expect(events[0]!.endsAt).toBe(events[0]!.startsAt);
  });
});
