import { describe, expect, it } from "vitest";
import { aggregateGroups, periodBucket } from "./custom-report";

describe("aggregateGroups", () => {
  it("count conta linhas por grupo, maior primeiro", () => {
    const rows = [
      { sourceId: "1", groupKey: "a", groupLabel: "A", metricValue: null },
      { sourceId: "2", groupKey: "a", groupLabel: "A", metricValue: null },
      { sourceId: "3", groupKey: "b", groupLabel: "B", metricValue: null },
    ];
    expect(aggregateGroups(rows, "count")).toEqual([
      { key: "a", label: "A", count: 2, value: 2 },
      { key: "b", label: "B", count: 1, value: 1 },
    ]);
  });

  it("sum soma o valor da métrica por grupo, ignora null", () => {
    const rows = [
      { sourceId: "1", groupKey: "a", groupLabel: "A", metricValue: 100 },
      { sourceId: "2", groupKey: "a", groupLabel: "A", metricValue: 50 },
      { sourceId: "3", groupKey: "a", groupLabel: "A", metricValue: null },
    ];
    expect(aggregateGroups(rows, "sum")).toEqual([{ key: "a", label: "A", count: 3, value: 150 }]);
  });

  it("avg/min/max", () => {
    const rows = [
      { sourceId: "1", groupKey: "a", groupLabel: "A", metricValue: 10 },
      { sourceId: "2", groupKey: "a", groupLabel: "A", metricValue: 30 },
    ];
    expect(aggregateGroups(rows, "avg")[0]!.value).toBe(20);
    expect(aggregateGroups(rows, "min")[0]!.value).toBe(10);
    expect(aggregateGroups(rows, "max")[0]!.value).toBe(30);
  });

  it("uma linha em múltiplos grupos (multi_select/relation múltiplo) conta em cada um", () => {
    const rows = [
      { sourceId: "1", groupKey: "urgente", groupLabel: "Urgente", metricValue: null },
      { sourceId: "1", groupKey: "trabalho", groupLabel: "Trabalho", metricValue: null },
    ];
    const result = aggregateGroups(rows, "count");
    expect(result).toHaveLength(2);
    expect(result.every((g) => g.count === 1)).toBe(true);
  });

  it("grupo vazio (só metricValue null) em sum/avg/min/max vale 0, não NaN", () => {
    const rows = [{ sourceId: "1", groupKey: "a", groupLabel: "A", metricValue: null }];
    expect(aggregateGroups(rows, "sum")[0]!.value).toBe(0);
    expect(aggregateGroups(rows, "avg")[0]!.value).toBe(0);
  });
});

describe("periodBucket", () => {
  it("day usa a própria data como chave", () => {
    expect(periodBucket("2026-09-23", "day")).toEqual({ key: "2026-09-23", label: "2026-09-23" });
  });

  it("month trunca pro mês", () => {
    expect(periodBucket("2026-09-23", "month")).toEqual({ key: "2026-09", label: "2026-09" });
  });

  it("week ancora na segunda-feira ISO, qualquer dia da semana cai no mesmo balde", () => {
    expect(periodBucket("2026-09-23", "week").key).toBe("2026-09-21");
    expect(periodBucket("2026-09-21", "week").key).toBe("2026-09-21");
    expect(periodBucket("2026-09-27", "week").key).toBe("2026-09-21");
    expect(periodBucket("2026-09-28", "week").key).toBe("2026-09-28");
  });
});
