import { describe, expect, it } from "vitest";
import { findPreviousMeeting, type MeetingItemForLookup } from "./find-previous-meeting";

function meeting(overrides: Partial<MeetingItemForLookup> = {}): MeetingItemForLookup {
  return { id: "m1", title: "Reunião", createdAt: "2026-01-01T00:00:00.000Z", participantIds: ["c1"], ...overrides };
}

describe("findPreviousMeeting", () => {
  it("sem participantes atuais: null", () => {
    expect(findPreviousMeeting([meeting()], [])).toBeNull();
  });

  it("sem nenhuma reunião com participante em comum: null", () => {
    expect(findPreviousMeeting([meeting({ participantIds: ["c2"] })], ["c1"])).toBeNull();
  });

  it("acha a reunião com participante em comum", () => {
    const m = meeting({ id: "m1", participantIds: ["c1", "c2"] });
    expect(findPreviousMeeting([m], ["c1"])?.id).toBe("m1");
  });

  it("nunca devolve a própria reunião sendo criada (excludeItemId)", () => {
    const m = meeting({ id: "m1", participantIds: ["c1"] });
    expect(findPreviousMeeting([m], ["c1"], "m1")).toBeNull();
  });

  it("com várias, devolve a mais recente (createdAt)", () => {
    const older = meeting({ id: "older", createdAt: "2026-01-01T00:00:00.000Z", participantIds: ["c1"] });
    const newer = meeting({ id: "newer", createdAt: "2026-06-01T00:00:00.000Z", participantIds: ["c1"] });
    expect(findPreviousMeeting([older, newer], ["c1"])?.id).toBe("newer");
  });

  it("participante em comum mesmo que só um dos vários bata", () => {
    const m = meeting({ id: "m1", participantIds: ["c9", "c1", "c8"] });
    expect(findPreviousMeeting([m], ["c1", "c2", "c3"])?.id).toBe("m1");
  });
});
