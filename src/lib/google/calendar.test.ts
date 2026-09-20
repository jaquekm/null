import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteGoogleEvent,
  GoogleEventConflictError,
  GoogleEventNotFoundError,
  GoogleSyncTokenExpiredError,
  insertGoogleEvent,
  listCalendarEvents,
  listGoogleCalendars,
  patchGoogleEvent,
} from "./calendar";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("listGoogleCalendars", () => {
  it("mapeia os itens da calendarList, com o principal marcado", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          items: [
            { id: "dono@example.com", summary: "Dono", primary: true, timeZone: "America/Sao_Paulo" },
            { id: "cal2@group.calendar.google.com", summary: "Trabalho", backgroundColor: "#fff" },
          ],
        }),
    });

    const calendars = await listGoogleCalendars("at");

    expect(calendars).toEqual([
      { id: "dono@example.com", summary: "Dono", backgroundColor: null, timeZone: "America/Sao_Paulo", primary: true },
      { id: "cal2@group.calendar.google.com", summary: "Trabalho", backgroundColor: "#fff", timeZone: null, primary: false },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/users/me/calendarList");
    expect(init.headers).toMatchObject({ authorization: "Bearer at" });
  });

  it("lança em HTTP não-ok", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(listGoogleCalendars("at")).rejects.toThrow(/HTTP 401/);
  });

  it("devolve [] quando a resposta não tem 'items'", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await expect(listGoogleCalendars("at")).resolves.toEqual([]);
  });
});

describe("listCalendarEvents", () => {
  it("sincronização completa: manda timeMin + orderBy + singleEvents, sem syncToken", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [{ id: "e1", etag: '"1"', status: "confirmed" }], nextSyncToken: "sync-1" }),
    });

    const page = await listCalendarEvents("at", "dono@example.com", { timeMin: "2026-01-01T00:00:00.000Z" });

    expect(page).toEqual({ events: [{ id: "e1", etag: '"1"', status: "confirmed" }], nextPageToken: null, nextSyncToken: "sync-1" });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/calendars/dono%40example.com/events?");
    expect(url).toContain("singleEvents=true");
    expect(url).toContain("timeMin=2026-01-01T00%3A00%3A00.000Z");
    expect(url).toContain("orderBy=startTime");
    expect(url).not.toContain("syncToken");
  });

  it("sincronização incremental: manda só syncToken + singleEvents, sem timeMin/orderBy", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ items: [] }) });

    await listCalendarEvents("at", "cal2", { syncToken: "prev-token" });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("syncToken=prev-token");
    expect(url).not.toContain("timeMin");
    expect(url).not.toContain("orderBy");
  });

  it("pagina com pageToken quando informado", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ items: [] }) });
    await listCalendarEvents("at", "cal2", { syncToken: "prev-token", pageToken: "page-2" });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("pageToken=page-2");
  });

  it("410 vira GoogleSyncTokenExpiredError", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 410 });
    await expect(listCalendarEvents("at", "cal2", { syncToken: "expirado" })).rejects.toThrow(GoogleSyncTokenExpiredError);
  });

  it("outro HTTP não-ok lança erro genérico", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(listCalendarEvents("at", "cal2", { timeMin: "2026-01-01T00:00:00.000Z" })).rejects.toThrow(/HTTP 500/);
  });
});

describe("insertGoogleEvent", () => {
  it("manda conferenceDataVersion=1 e o corpo do evento, com Meet quando pedido", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ id: "e1", etag: '"1"', status: "confirmed" }) });

    await insertGoogleEvent("at", "cal2", {
      summary: "Reunião",
      start: { dateTime: "2026-01-01T10:00:00-03:00" },
      end: { dateTime: "2026-01-01T11:00:00-03:00" },
      attendeeEmails: ["a@example.com"],
      addMeet: true,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("conferenceDataVersion=1");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.summary).toBe("Reunião");
    expect(body.attendees).toEqual([{ email: "a@example.com" }]);
    expect(body.conferenceData.createRequest.conferenceSolutionKey).toEqual({ type: "hangoutsMeet" });
  });

  it("lança em HTTP não-ok", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });
    await expect(
      insertGoogleEvent("at", "cal2", { summary: "x", start: {}, end: {} }),
    ).rejects.toThrow(/HTTP 400/);
  });
});

describe("patchGoogleEvent", () => {
  it("manda If-Match quando um etag é informado", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ id: "e1", etag: '"2"', status: "confirmed" }) });

    await patchGoogleEvent("at", "cal2", "e1", { summary: "Novo título", start: {}, end: {} }, '"1"');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/events/e1?conferenceDataVersion=1");
    expect(init.method).toBe("PATCH");
    expect((init.headers as Record<string, string>)["if-match"]).toBe('"1"');
  });

  it("412 vira GoogleEventConflictError (o Google venceu o conflito)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 412 });
    await expect(
      patchGoogleEvent("at", "cal2", "e1", { summary: "x", start: {}, end: {} }, '"velho"'),
    ).rejects.toThrow(GoogleEventConflictError);
  });

  it("404 vira GoogleEventNotFoundError", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(patchGoogleEvent("at", "cal2", "sumiu", { summary: "x", start: {}, end: {} })).rejects.toThrow(
      GoogleEventNotFoundError,
    );
  });
});

describe("deleteGoogleEvent", () => {
  it("204: não lança", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204 });
    await expect(deleteGoogleEvent("at", "cal2", "e1")).resolves.toBeUndefined();
  });

  it("404/410 viram GoogleEventNotFoundError (já não existe — tratado como sucesso por quem chama)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(deleteGoogleEvent("at", "cal2", "e1")).rejects.toThrow(GoogleEventNotFoundError);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 410 });
    await expect(deleteGoogleEvent("at", "cal2", "e1")).rejects.toThrow(GoogleEventNotFoundError);
  });

  it("outro HTTP não-ok lança erro genérico", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(deleteGoogleEvent("at", "cal2", "e1")).rejects.toThrow(/HTTP 500/);
  });
});
