import { describe, expect, it } from "vitest";
import { aggregateUsage, type UsageEventRow } from "./aggregate-usage";

// America/Sao_Paulo é UTC-3 (sem horário de verão atualmente) — meia-noite
// local é 03:00 UTC. Os literais abaixo usam isso pra que `rangeStart`/
// `rangeEnd` caiam exatamente na meia-noite local dos dias do teste.
const TZ = "America/Sao_Paulo";

describe("aggregateUsage", () => {
  it("soma por provedor, recurso e dia", () => {
    const rows: UsageEventRow[] = [
      { provider: "anthropic", feature: "meeting_summary", costUsd: 1.5, createdAt: "2026-09-01T12:00:00.000Z" },
      { provider: "anthropic", feature: "ocr", costUsd: 0.5, createdAt: "2026-09-01T15:00:00.000Z" },
      { provider: "transcription", feature: "transcription", costUsd: 2, createdAt: "2026-09-02T12:00:00.000Z" },
    ];

    const summary = aggregateUsage(rows, TZ, new Date("2026-09-01T03:00:00.000Z"), new Date("2026-09-03T03:00:00.000Z"));

    expect(summary.totalUsd).toBe(4);
    expect(summary.byProvider).toEqual([
      { key: "anthropic", usd: 2 },
      { key: "transcription", usd: 2 },
    ]);
    expect(summary.byFeature).toEqual([
      { key: "transcription", usd: 2 },
      { key: "meeting_summary", usd: 1.5 },
      { key: "ocr", usd: 0.5 },
    ]);
  });

  it("cost_usd nulo conta como 0, não trava a soma", () => {
    const rows: UsageEventRow[] = [{ provider: "anthropic", feature: "ocr", costUsd: null, createdAt: "2026-09-01T12:00:00.000Z" }];
    const summary = aggregateUsage(rows, TZ, new Date("2026-09-01T03:00:00.000Z"), new Date("2026-09-01T03:00:00.000Z"));
    expect(summary.totalUsd).toBe(0);
  });

  it("gera um ponto por dia do intervalo, mesmo sem gasto", () => {
    const summary = aggregateUsage([], TZ, new Date("2026-09-01T03:00:00.000Z"), new Date("2026-09-03T03:00:00.000Z"));
    expect(summary.daily).toEqual([
      { date: "2026-09-01", usd: 0 },
      { date: "2026-09-02", usd: 0 },
      { date: "2026-09-03", usd: 0 },
    ]);
  });

  it("agrupa por dia local (fuso), não UTC", () => {
    // 2026-09-01T02:00:00Z é 2026-08-31 23:00 em America/Sao_Paulo (UTC-3)
    const rows: UsageEventRow[] = [{ provider: "anthropic", feature: "ocr", costUsd: 1, createdAt: "2026-09-01T02:00:00.000Z" }];
    const summary = aggregateUsage(rows, TZ, new Date("2026-08-31T03:00:00.000Z"), new Date("2026-09-01T03:00:00.000Z"));
    const day = summary.daily.find((d) => d.date === "2026-08-31");
    expect(day?.usd).toBe(1);
  });
});
