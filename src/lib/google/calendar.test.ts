import { beforeEach, describe, expect, it, vi } from "vitest";
import { listGoogleCalendars } from "./calendar";

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
