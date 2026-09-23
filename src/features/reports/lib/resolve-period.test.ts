import { describe, expect, it } from "vitest";
import { resolveRelativePeriod } from "./resolve-period";

const NOW = new Date("2026-09-23T15:00:00.000Z");
const TZ = "America/Sao_Paulo";

describe("resolveRelativePeriod", () => {
  it("this_month", () => {
    const result = resolveRelativePeriod("this_month", NOW, TZ);
    expect(result.startDateKey).toBe("2026-09-01");
    expect(result.endDateKey).toBe("2026-09-30");
    expect(result.start).toBe("2026-09-01T03:00:00.000Z");
    expect(result.end).toBe("2026-10-01T02:59:59.999Z");
  });

  it("last_month", () => {
    const result = resolveRelativePeriod("last_month", NOW, TZ);
    expect(result.startDateKey).toBe("2026-08-01");
    expect(result.endDateKey).toBe("2026-08-31");
  });

  it("last_7_days inclui hoje, 7 dias no total", () => {
    const result = resolveRelativePeriod("last_7_days", NOW, TZ);
    expect(result.startDateKey).toBe("2026-09-17");
    expect(result.endDateKey).toBe("2026-09-23");
  });

  it("last_quarter", () => {
    const result = resolveRelativePeriod("last_quarter", NOW, TZ);
    expect(result.startDateKey).toBe("2026-04-01");
    expect(result.endDateKey).toBe("2026-06-30");
  });

  it("this_year", () => {
    const result = resolveRelativePeriod("this_year", NOW, TZ);
    expect(result.startDateKey).toBe("2026-01-01");
    expect(result.endDateKey).toBe("2026-12-31");
  });

  it("custom usa as datas informadas direto", () => {
    const result = resolveRelativePeriod("custom", NOW, TZ, { start: "2026-01-15", end: "2026-02-10" });
    expect(result.startDateKey).toBe("2026-01-15");
    expect(result.endDateKey).toBe("2026-02-10");
  });

  it("custom sem start/end lança erro", () => {
    expect(() => resolveRelativePeriod("custom", NOW, TZ)).toThrow();
  });
});
