import { addDays, addMonths, addWeeks, endOfMonth, endOfQuarter, endOfWeek, startOfMonth, startOfQuarter, startOfWeek } from "date-fns";

/** Linha do tempo / Gantt simples (5.4) — zoom semana/mês/trimestre. */
export const ganttZooms = ["week", "month", "quarter"] as const;
export type GanttZoom = (typeof ganttZooms)[number];

export interface GanttWindow {
  start: Date;
  end: Date;
}

/** Janela visível ao redor de `anchor`, de acordo com o zoom escolhido. */
export function computeGanttWindow(anchor: Date, zoom: GanttZoom): GanttWindow {
  switch (zoom) {
    case "week":
      return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) };
    case "month":
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    case "quarter":
      return { start: startOfQuarter(anchor), end: endOfQuarter(anchor) };
  }
}

/** Anterior/próxima janela do mesmo tamanho de zoom (botões "< >" do cabeçalho). */
export function shiftGanttWindow(window: GanttWindow, zoom: GanttZoom, direction: 1 | -1): GanttWindow {
  switch (zoom) {
    case "week":
      return computeGanttWindow(addWeeks(window.start, direction), "week");
    case "month":
      return computeGanttWindow(addMonths(window.start, direction), "month");
    case "quarter":
      return computeGanttWindow(addMonths(window.start, direction * 3), "quarter");
  }
}

/** Posição de uma data dentro da janela, em % (fora da janela vira 0/100 — clampado por quem chama). */
export function dateToPercent(date: Date, window: GanttWindow): number {
  const total = window.end.getTime() - window.start.getTime();
  if (total <= 0) return 0;
  return ((date.getTime() - window.start.getTime()) / total) * 100;
}

/** Inverso de `dateToPercent` — usado ao soltar/redimensionar uma barra (posição do mouse → data). */
export function percentToDate(percent: number, window: GanttWindow): Date {
  const total = window.end.getTime() - window.start.getTime();
  return new Date(window.start.getTime() + (percent / 100) * total);
}

export interface GanttBarPosition {
  leftPercent: number;
  widthPercent: number;
}

const MIN_WIDTH_PERCENT = 1;

/** `left`/`width` (em %) de uma barra — clampada à janela visível, com largura mínima pra continuar clicável/arrastável. */
export function computeBarPosition(start: Date, end: Date, window: GanttWindow): GanttBarPosition {
  const left = Math.max(0, Math.min(100, dateToPercent(start, window)));
  const right = Math.max(0, Math.min(100, dateToPercent(end, window)));
  return { leftPercent: left, widthPercent: Math.max(right - left, MIN_WIDTH_PERCENT) };
}

/** Posição da linha do "hoje" — `null` se hoje está fora da janela visível. */
export function todayPercent(window: GanttWindow, now: Date = new Date()): number | null {
  if (now.getTime() < window.start.getTime() || now.getTime() > window.end.getTime()) return null;
  return dateToPercent(now, window);
}

/** Desloca uma data em dias inteiros, preservando a hora — granularidade de arrastar/redimensionar (5.4: "altera datas"). */
export function shiftDateByDays(date: Date, days: number): Date {
  return addDays(date, days);
}

/** Deslocamento em pixels (arrastar o mouse) → dias inteiros, dado quantos dias cabem na largura do contêiner. */
export function pixelsToDays(deltaPx: number, containerWidthPx: number, window: GanttWindow): number {
  if (containerWidthPx <= 0) return 0;
  const totalDays = (window.end.getTime() - window.start.getTime()) / (24 * 60 * 60 * 1000);
  return Math.round((deltaPx / containerWidthPx) * totalDays);
}

/**
 * `properties[key]` (string bruta, `date` = "AAAA-MM-DD" ou `datetime` =
 * ISO) → `Date`, pra desenhar a barra. Campo `date` é lido como meia-noite
 * UTC (mesma leitura usada por `shiftFieldDateValue` abaixo) — evita que o
 * fuso do navegador jogue o dia pra trás ou pra frente.
 */
export function parseFieldDate(value: unknown, fieldType: "date" | "datetime"): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(fieldType === "date" ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Desloca o valor bruto de um campo `date`/`datetime` em dias inteiros —
 * usado ao soltar/redimensionar uma barra. `date` faz aritmética de
 * calendário em UTC (sem hora, sem fuso — "dia 5" mais 3 dias é sempre
 * "dia 8", em qualquer fuso do navegador); `datetime` preserva a hora.
 */
export function shiftFieldDateValue(value: string, days: number, fieldType: "date" | "datetime"): string {
  if (fieldType === "date") {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  return shiftDateByDays(new Date(value), days).toISOString();
}
