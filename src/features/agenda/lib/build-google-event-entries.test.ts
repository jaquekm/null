import { describe, expect, it } from "vitest";
import { buildGoogleEventEntries, type GoogleEventRowForAgenda } from "./build-google-event-entries";

function event(overrides: Partial<GoogleEventRowForAgenda> = {}): GoogleEventRowForAgenda {
  return {
    id: "ev-1",
    title: "Reunião",
    starts_at: "2026-01-05T13:00:00.000Z",
    ends_at: "2026-01-05T14:00:00.000Z",
    all_day: false,
    status: "confirmed",
    calendar_id: "cal-1",
    ...overrides,
  };
}

describe("buildGoogleEventEntries", () => {
  it("mapeia campos básicos, usando a cor do calendário", () => {
    const colors = new Map([["cal-1", "#ff0000"]]);
    const entries = buildGoogleEventEntries([event()], colors);
    expect(entries).toEqual([
      {
        id: "event:ev-1",
        title: "Reunião",
        start: "2026-01-05T13:00:00.000Z",
        end: "2026-01-05T14:00:00.000Z",
        allDay: false,
        color: "#ff0000",
        editable: true,
        kind: "google-event",
        href: null,
      },
    ]);
  });

  it("calendário sem cor cadastrada: usa a cor padrão", () => {
    const colors = new Map<string, string | null>([["cal-1", null]]);
    const entries = buildGoogleEventEntries([event()], colors);
    expect(entries[0]?.color).toBe("#2563eb");
  });

  it("calendar_id que não está no mapa: usa a cor padrão", () => {
    const entries = buildGoogleEventEntries([event({ calendar_id: "cal-desconhecido" })], new Map());
    expect(entries[0]?.color).toBe("#2563eb");
  });

  it("filtra eventos cancelled", () => {
    const entries = buildGoogleEventEntries([event({ status: "cancelled" })], new Map());
    expect(entries).toEqual([]);
  });
});
