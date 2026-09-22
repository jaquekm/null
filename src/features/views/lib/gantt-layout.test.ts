import { describe, expect, it } from "vitest";
import {
  computeBarPosition,
  computeGanttWindow,
  dateToPercent,
  parseFieldDate,
  percentToDate,
  pixelsToDays,
  shiftDateByDays,
  shiftFieldDateValue,
  shiftGanttWindow,
  todayPercent,
} from "./gantt-layout";

describe("computeGanttWindow", () => {
  it("week: segunda a domingo", () => {
    const window = computeGanttWindow(new Date("2026-09-24T12:00:00Z"), "week"); // uma quinta
    expect(window.start.getUTCDay()).toBe(1); // segunda
    expect(window.end.getUTCDay()).toBe(0); // domingo
  });

  it("month: primeiro ao último dia do mês", () => {
    const window = computeGanttWindow(new Date("2026-09-15T12:00:00Z"), "month");
    expect(window.start.getUTCDate()).toBe(1);
    expect(window.end.getUTCMonth()).toBe(window.start.getUTCMonth());
  });

  it("quarter: 3 meses", () => {
    const window = computeGanttWindow(new Date("2026-09-15T12:00:00Z"), "quarter");
    const spanMonths = (window.end.getUTCFullYear() - window.start.getUTCFullYear()) * 12 + (window.end.getUTCMonth() - window.start.getUTCMonth());
    expect(spanMonths).toBe(2); // jul, ago, set
  });
});

describe("shiftGanttWindow", () => {
  it("mês seguinte tem o mesmo tamanho de janela (mês)", () => {
    const window = computeGanttWindow(new Date("2026-09-15T12:00:00Z"), "month");
    const next = shiftGanttWindow(window, "month", 1);
    expect(next.start.getUTCMonth()).toBe((window.start.getUTCMonth() + 1) % 12);
  });

  it("semana anterior volta 7 dias", () => {
    const window = computeGanttWindow(new Date("2026-09-24T12:00:00Z"), "week");
    const prev = shiftGanttWindow(window, "week", -1);
    expect(window.start.getTime() - prev.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("dateToPercent / percentToDate", () => {
  const window = { start: new Date("2026-09-01T00:00:00Z"), end: new Date("2026-09-11T00:00:00Z") }; // 10 dias

  it("início e fim da janela são 0% e 100%", () => {
    expect(dateToPercent(window.start, window)).toBe(0);
    expect(dateToPercent(window.end, window)).toBe(100);
  });

  it("meio da janela é 50%", () => {
    expect(dateToPercent(new Date("2026-09-06T00:00:00Z"), window)).toBe(50);
  });

  it("percentToDate é o inverso de dateToPercent", () => {
    const date = new Date("2026-09-04T00:00:00Z");
    const percent = dateToPercent(date, window);
    expect(percentToDate(percent, window).getTime()).toBe(date.getTime());
  });
});

describe("computeBarPosition", () => {
  const window = { start: new Date("2026-09-01T00:00:00Z"), end: new Date("2026-09-11T00:00:00Z") };

  it("barra totalmente dentro da janela", () => {
    const bar = computeBarPosition(new Date("2026-09-02T00:00:00Z"), new Date("2026-09-04T00:00:00Z"), window);
    expect(bar.leftPercent).toBe(10);
    expect(bar.widthPercent).toBe(20);
  });

  it("barra que começa antes da janela é clampada em 0%", () => {
    const bar = computeBarPosition(new Date("2026-08-20T00:00:00Z"), new Date("2026-09-04T00:00:00Z"), window);
    expect(bar.leftPercent).toBe(0);
  });

  it("barra muito curta tem largura mínima (continua clicável)", () => {
    const bar = computeBarPosition(new Date("2026-09-05T00:00:00Z"), new Date("2026-09-05T01:00:00Z"), window);
    expect(bar.widthPercent).toBeGreaterThanOrEqual(1);
  });
});

describe("todayPercent", () => {
  const window = { start: new Date("2026-09-01T00:00:00Z"), end: new Date("2026-09-11T00:00:00Z") };

  it("hoje dentro da janela retorna a posição", () => {
    expect(todayPercent(window, new Date("2026-09-06T00:00:00Z"))).toBe(50);
  });

  it("hoje fora da janela retorna null", () => {
    expect(todayPercent(window, new Date("2026-10-01T00:00:00Z"))).toBeNull();
  });
});

describe("shiftDateByDays", () => {
  it("soma/subtrai dias preservando a hora", () => {
    const date = new Date("2026-09-01T14:30:00Z");
    expect(shiftDateByDays(date, 3).toISOString()).toBe("2026-09-04T14:30:00.000Z");
    expect(shiftDateByDays(date, -1).toISOString()).toBe("2026-08-31T14:30:00.000Z");
  });
});

describe("parseFieldDate", () => {
  it("campo date: meia-noite UTC", () => {
    const date = parseFieldDate("2026-09-15", "date");
    expect(date?.toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("campo datetime: ISO direto", () => {
    const date = parseFieldDate("2026-09-15T14:30:00.000Z", "datetime");
    expect(date?.toISOString()).toBe("2026-09-15T14:30:00.000Z");
  });

  it("valor vazio/inválido: null", () => {
    expect(parseFieldDate("", "date")).toBeNull();
    expect(parseFieldDate(undefined, "date")).toBeNull();
    expect(parseFieldDate("não é data", "date")).toBeNull();
  });
});

describe("shiftFieldDateValue", () => {
  it("campo date: aritmética de calendário, sem hora", () => {
    expect(shiftFieldDateValue("2026-09-28", 5, "date")).toBe("2026-10-03");
    expect(shiftFieldDateValue("2026-09-05", -3, "date")).toBe("2026-09-02");
  });

  it("campo datetime: preserva a hora", () => {
    expect(shiftFieldDateValue("2026-09-15T14:30:00.000Z", 2, "datetime")).toBe("2026-09-17T14:30:00.000Z");
  });
});

describe("pixelsToDays", () => {
  const window = { start: new Date("2026-09-01T00:00:00Z"), end: new Date("2026-09-11T00:00:00Z") }; // 10 dias

  it("metade da largura do contêiner = metade dos dias", () => {
    expect(pixelsToDays(500, 1000, window)).toBe(5);
  });

  it("contêiner sem largura não quebra (0)", () => {
    expect(pixelsToDays(100, 0, window)).toBe(0);
  });
});
