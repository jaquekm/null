import { formatInTimeZone } from "date-fns-tz";

/** Janela padrão da linha do tempo do planejador do dia (3.6) quando não há evento fora desse intervalo. */
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;
const MINUTES_PER_HOUR = 60;
/** Altura visual mínima de um bloco (em % da janela) — evento de poucos minutos ainda precisa ser clicável. */
const MIN_BLOCK_MINUTES = 15;

export interface TimelineWindow {
  startMinutes: number;
  endMinutes: number;
}

export interface TimelineBlockPosition {
  topPercent: number;
  heightPercent: number;
}

/** Minutos desde a meia-noite **no fuso do dono** (3.6) — não no fuso do servidor/navegador. */
export function computeMinutesSinceMidnight(iso: string, timezone: string): number {
  const [hours, minutes] = formatInTimeZone(new Date(iso), timezone, "HH:mm").split(":").map(Number);
  return (hours ?? 0) * MINUTES_PER_HOUR + (minutes ?? 0);
}

/** 6h–22h por padrão, expandida se algum evento começar antes ou terminar depois. */
export function computeTimelineWindow(events: { startMinutes: number; endMinutes: number }[]): TimelineWindow {
  let startMinutes = DEFAULT_START_HOUR * MINUTES_PER_HOUR;
  let endMinutes = DEFAULT_END_HOUR * MINUTES_PER_HOUR;
  for (const event of events) {
    startMinutes = Math.min(startMinutes, event.startMinutes);
    endMinutes = Math.max(endMinutes, event.endMinutes);
  }
  return { startMinutes, endMinutes };
}

/** Posição/altura do bloco dentro da janela, em porcentagem (pra `style={{ top, height }}` com `%`). */
export function computeBlockPosition(startMinutes: number, endMinutes: number, window: TimelineWindow): TimelineBlockPosition {
  const totalSpan = window.endMinutes - window.startMinutes;
  const clampedStart = Math.min(Math.max(startMinutes, window.startMinutes), window.endMinutes);
  const minEnd = clampedStart + MIN_BLOCK_MINUTES;
  const clampedEnd = Math.min(Math.max(endMinutes, minEnd), window.endMinutes);

  return {
    topPercent: ((clampedStart - window.startMinutes) / totalSpan) * 100,
    heightPercent: ((clampedEnd - clampedStart) / totalSpan) * 100,
  };
}

/** Início (em minutos desde a meia-noite) de cada slot de hora cheia dentro da janela — pra desenhar linhas/soltar tarefas. */
export function hourSlotStarts(window: TimelineWindow): number[] {
  const slots: number[] = [];
  const firstHour = Math.floor(window.startMinutes / MINUTES_PER_HOUR);
  const lastHour = Math.ceil(window.endMinutes / MINUTES_PER_HOUR);
  for (let hour = firstHour; hour < lastHour; hour++) {
    slots.push(hour * MINUTES_PER_HOUR);
  }
  return slots;
}
