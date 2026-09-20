import { describe, expect, it } from "vitest";
import { buildReminderEntries } from "./build-reminder-entries";

describe("buildReminderEntries", () => {
  it("mapeia lembretes como eventos pontuais, sem `end`", () => {
    const entries = buildReminderEntries([{ id: "r1", title: "Ligar pro cliente", send_at: "2026-01-05T09:00:00.000Z" }]);
    expect(entries).toEqual([
      {
        id: "reminder:r1",
        title: "Ligar pro cliente",
        start: "2026-01-05T09:00:00.000Z",
        end: null,
        allDay: false,
        color: "#7c3aed",
        editable: false,
        kind: "reminder",
        href: "/lembretes",
      },
    ]);
  });

  it("lista vazia: []", () => {
    expect(buildReminderEntries([])).toEqual([]);
  });
});
