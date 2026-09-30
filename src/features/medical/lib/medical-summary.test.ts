import { describe, expect, it } from "vitest";
import { mostRecent, nextUpcoming, splitByToday } from "./medical-summary";

const items = [
  { id: "1", title: "Cardiologista", date: "2026-09-20" },
  { id: "2", title: "Dermatologista", date: "2026-10-05" },
  { id: "3", title: "Oftalmologista", date: "2026-09-30" },
  { id: "4", title: "Dentista", date: "2026-10-01" },
];

describe("nextUpcoming", () => {
  it("a mais próxima a partir de hoje (inclusive)", () => expect(nextUpcoming(items, "2026-09-30")?.title).toBe("Oftalmologista"));
  it("sem nenhuma futura", () => expect(nextUpcoming(items, "2026-11-01")).toBeNull());
});

describe("splitByToday", () => {
  it("separa futuras (mais próxima primeiro) e passadas (mais recente primeiro)", () => {
    const { upcoming, past } = splitByToday(items, "2026-09-30");
    expect(upcoming.map((i) => i.title)).toEqual(["Oftalmologista", "Dentista", "Dermatologista"]);
    expect(past.map((i) => i.title)).toEqual(["Cardiologista"]);
  });
});

describe("mostRecent", () => {
  it("os N mais recentes, do mais novo pro mais antigo", () => {
    expect(mostRecent(items, 2).map((i) => i.title)).toEqual(["Dermatologista", "Dentista"]);
  });
});
