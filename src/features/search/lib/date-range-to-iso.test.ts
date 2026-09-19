import { describe, expect, it } from "vitest";
import { dateRangeToIso } from "./date-range-to-iso";

describe("dateRangeToIso", () => {
  it("datas vazias viram null nos dois limites", () => {
    expect(dateRangeToIso("", "")).toEqual({ after: null, before: null });
  });

  it("'de' vira o início do dia local", () => {
    const { after } = dateRangeToIso("2026-01-10", "");
    expect(new Date(after!).getHours()).toBe(0);
    expect(new Date(after!).getMinutes()).toBe(0);
    expect(new Date(after!).getDate()).toBe(10);
  });

  it("'até' vira o fim do dia local", () => {
    const { before } = dateRangeToIso("", "2026-01-10");
    expect(new Date(before!).getHours()).toBe(23);
    expect(new Date(before!).getMinutes()).toBe(59);
    expect(new Date(before!).getDate()).toBe(10);
  });

  it("'de' sempre vem antes de 'até' no mesmo dia", () => {
    const { after, before } = dateRangeToIso("2026-03-05", "2026-03-05");
    expect(new Date(after!).getTime()).toBeLessThan(new Date(before!).getTime());
  });
});
