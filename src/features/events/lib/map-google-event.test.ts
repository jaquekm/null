import { describe, expect, it } from "vitest";
import type { GoogleCalendarEvent } from "@/lib/google/calendar";
import { mapGoogleEventToRow } from "./map-google-event";

function baseEvent(overrides: Partial<GoogleCalendarEvent> = {}): GoogleCalendarEvent {
  return {
    id: "ext-1",
    etag: '"abc"',
    status: "confirmed",
    summary: "Reunião com cliente",
    start: { dateTime: "2026-01-05T10:00:00-03:00", timeZone: "America/Sao_Paulo" },
    end: { dateTime: "2026-01-05T11:00:00-03:00", timeZone: "America/Sao_Paulo" },
    ...overrides,
  };
}

describe("mapGoogleEventToRow", () => {
  it("mapeia um evento com horário", () => {
    const row = mapGoogleEventToRow(baseEvent());
    expect(row).toEqual({
      external_id: "ext-1",
      title: "Reunião com cliente",
      description: null,
      location: null,
      starts_at: new Date("2026-01-05T10:00:00-03:00").toISOString(),
      ends_at: new Date("2026-01-05T11:00:00-03:00").toISOString(),
      all_day: false,
      timezone: "America/Sao_Paulo",
      status: "confirmed",
      attendees: [],
      recurring_event_external_id: null,
      remote_etag: '"abc"',
      remote_updated_at: null,
      conference_url: null,
    });
  });

  it("evento de dia inteiro (`date`, sem `dateTime`) vira all_day=true, sem fuso", () => {
    const row = mapGoogleEventToRow(
      baseEvent({ start: { date: "2026-01-10" }, end: { date: "2026-01-11" } }),
    );
    expect(row.all_day).toBe(true);
    expect(row.timezone).toBeNull();
    expect(row.starts_at).toBe("2026-01-10T00:00:00.000Z");
    expect(row.ends_at).toBe("2026-01-11T00:00:00.000Z");
  });

  it("sem título vira '(sem título)', igual ao default da coluna", () => {
    const row = mapGoogleEventToRow(baseEvent({ summary: undefined }));
    expect(row.title).toBe("(sem título)");
  });

  it("título só com espaços também vira '(sem título)'", () => {
    const row = mapGoogleEventToRow(baseEvent({ summary: "   " }));
    expect(row.title).toBe("(sem título)");
  });

  it("mapeia attendees pro formato { email, name, response }", () => {
    const row = mapGoogleEventToRow(
      baseEvent({
        attendees: [
          { email: "a@example.com", displayName: "Fulano", responseStatus: "accepted" },
          { email: "b@example.com" },
        ],
      }),
    );
    expect(row.attendees).toEqual([
      { email: "a@example.com", name: "Fulano", response: "accepted" },
      { email: "b@example.com", name: null, response: null },
    ]);
  });

  it("status desconhecido vira 'confirmed'", () => {
    const row = mapGoogleEventToRow(baseEvent({ status: "algo-novo-que-o-google-inventou" }));
    expect(row.status).toBe("confirmed");
  });

  it("status 'cancelled' é preservado", () => {
    const row = mapGoogleEventToRow(baseEvent({ status: "cancelled" }));
    expect(row.status).toBe("cancelled");
  });

  it("recurringEventId e hangoutLink, quando presentes", () => {
    const row = mapGoogleEventToRow(baseEvent({ recurringEventId: "master-1", hangoutLink: "https://meet.google.com/abc" }));
    expect(row.recurring_event_external_id).toBe("master-1");
    expect(row.conference_url).toBe("https://meet.google.com/abc");
  });

  it("lança se não tiver start nem end", () => {
    expect(() => mapGoogleEventToRow(baseEvent({ start: undefined }))).toThrow();
  });
});
