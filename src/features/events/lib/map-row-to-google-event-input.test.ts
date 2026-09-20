import { describe, expect, it } from "vitest";
import { mapRowToGoogleEventInput } from "./map-row-to-google-event-input";

function baseRow(overrides: Partial<Parameters<typeof mapRowToGoogleEventInput>[0]> = {}) {
  return {
    title: "Reunião",
    description: null,
    location: null,
    starts_at: "2026-01-05T13:00:00.000Z",
    ends_at: "2026-01-05T14:00:00.000Z",
    all_day: false,
    timezone: "America/Sao_Paulo",
    attendees: [],
    ...overrides,
  };
}

describe("mapRowToGoogleEventInput", () => {
  it("evento com horário: dateTime + timeZone", () => {
    const input = mapRowToGoogleEventInput(baseRow());
    expect(input.start).toEqual({ dateTime: "2026-01-05T13:00:00.000Z", timeZone: "America/Sao_Paulo" });
    expect(input.end).toEqual({ dateTime: "2026-01-05T14:00:00.000Z", timeZone: "America/Sao_Paulo" });
  });

  it("evento de dia inteiro: só `date`, sem hora nem fuso", () => {
    const input = mapRowToGoogleEventInput(baseRow({ all_day: true }));
    expect(input.start).toEqual({ date: "2026-01-05" });
    expect(input.end).toEqual({ date: "2026-01-05" });
  });

  it("extrai e-mails de attendees (jsonb), ignorando entradas inválidas", () => {
    const input = mapRowToGoogleEventInput(
      baseRow({ attendees: [{ email: "a@example.com" }, { email: "b@example.com" }, {}, "lixo", null] }),
    );
    expect(input.attendeeEmails).toEqual(["a@example.com", "b@example.com"]);
  });

  it("attendees ausente ou não-array: []", () => {
    expect(mapRowToGoogleEventInput(baseRow({ attendees: null })).attendeeEmails).toEqual([]);
    expect(mapRowToGoogleEventInput(baseRow({ attendees: undefined })).attendeeEmails).toEqual([]);
  });

  it("descrição/local nulos viram undefined (não sobrescrevem com null no Google)", () => {
    const input = mapRowToGoogleEventInput(baseRow({ description: null, location: null }));
    expect(input.description).toBeUndefined();
    expect(input.location).toBeUndefined();
  });
});
