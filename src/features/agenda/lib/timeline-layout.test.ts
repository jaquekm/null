import { describe, expect, it } from "vitest";
import { computeBlockPosition, computeMinutesSinceMidnight, computeTimelineWindow, hourSlotStarts } from "./timeline-layout";

describe("computeMinutesSinceMidnight", () => {
  it("converte um instante UTC pro minuto do dia no fuso informado", () => {
    // 13:00 UTC = 10:00 em America/Sao_Paulo (UTC-3)
    expect(computeMinutesSinceMidnight("2026-01-05T13:00:00.000Z", "America/Sao_Paulo")).toBe(10 * 60);
  });

  it("meia-noite no fuso vira 0", () => {
    expect(computeMinutesSinceMidnight("2026-01-05T03:00:00.000Z", "America/Sao_Paulo")).toBe(0);
  });
});

describe("computeTimelineWindow", () => {
  it("janela padrão (6h–22h) quando nenhum evento passa disso", () => {
    expect(computeTimelineWindow([{ startMinutes: 9 * 60, endMinutes: 10 * 60 }])).toEqual({
      startMinutes: 6 * 60,
      endMinutes: 22 * 60,
    });
  });

  it("expande pra trás quando um evento começa antes das 6h", () => {
    expect(computeTimelineWindow([{ startMinutes: 5 * 60, endMinutes: 6 * 60 }])).toEqual({
      startMinutes: 5 * 60,
      endMinutes: 22 * 60,
    });
  });

  it("expande pra frente quando um evento termina depois das 22h", () => {
    expect(computeTimelineWindow([{ startMinutes: 21 * 60, endMinutes: 23 * 60 }])).toEqual({
      startMinutes: 6 * 60,
      endMinutes: 23 * 60,
    });
  });

  it("sem eventos: janela padrão", () => {
    expect(computeTimelineWindow([])).toEqual({ startMinutes: 6 * 60, endMinutes: 22 * 60 });
  });
});

describe("computeBlockPosition", () => {
  const window = { startMinutes: 6 * 60, endMinutes: 22 * 60 }; // 16h de janela = 960 min

  it("evento no meio da janela", () => {
    // 10h-11h dentro de 6h-22h: top = (600-360)/960 = 25%, height = 60/960 = 6.25%
    const pos = computeBlockPosition(10 * 60, 11 * 60, window);
    expect(pos.topPercent).toBeCloseTo(25, 5);
    expect(pos.heightPercent).toBeCloseTo(6.25, 5);
  });

  it("evento que começa antes da janela: recorta o início", () => {
    const pos = computeBlockPosition(4 * 60, 7 * 60, window);
    expect(pos.topPercent).toBe(0);
  });

  it("evento que termina depois da janela: recorta o fim", () => {
    const pos = computeBlockPosition(21 * 60, 23 * 60, window);
    expect(pos.topPercent + pos.heightPercent).toBeCloseTo(100, 5);
  });

  it("evento muito curto: altura mínima visual", () => {
    const pos = computeBlockPosition(10 * 60, 10 * 60 + 1, window);
    expect(pos.heightPercent).toBeCloseTo((15 / 960) * 100, 5);
  });
});

describe("hourSlotStarts", () => {
  it("uma entrada por hora cheia dentro da janela", () => {
    expect(hourSlotStarts({ startMinutes: 6 * 60, endMinutes: 9 * 60 })).toEqual([6 * 60, 7 * 60, 8 * 60]);
  });

  it("janela não alinhada em hora cheia: arredonda pra fora", () => {
    expect(hourSlotStarts({ startMinutes: 6 * 60 + 30, endMinutes: 8 * 60 + 15 })).toEqual([6 * 60, 7 * 60, 8 * 60]);
  });
});
