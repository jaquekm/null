"use client";

import { useDroppable } from "@dnd-kit/core";
import { computeBlockPosition, hourSlotStarts, type TimelineWindow } from "../lib/timeline-layout";

export interface TimelineEvent {
  id: string;
  title: string;
  color: string;
  startMinutes: number;
  endMinutes: number;
}

function formatHour(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:00`;
}

function HourSlot({ slotStart, window }: { slotStart: number; window: TimelineWindow }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${slotStart}` });
  const { topPercent, heightPercent } = computeBlockPosition(slotStart, slotStart + 60, window);

  return (
    <div
      ref={setNodeRef}
      style={{ top: `${topPercent}%`, height: `${heightPercent}%` }}
      className={`absolute right-0 left-12 border-t border-black/[.06] dark:border-white/[.06] ${
        isOver ? "bg-black/[.04] dark:bg-white/[.06]" : ""
      }`}
    />
  );
}

/** Linha do tempo do dia (3.6) — eventos posicionados por horário; cada hora é um alvo de soltar tarefa (`slot:<minutos>`). */
export function TodayTimeline({ events, window }: { events: TimelineEvent[]; window: TimelineWindow }) {
  const slots = hourSlotStarts(window);

  return (
    <div className="relative" style={{ height: `${slots.length * 56}px` }}>
      {slots.map((slotStart) => (
        <div key={slotStart} className="absolute left-0 w-12 -translate-y-2 text-right text-xs text-zinc-400 dark:text-zinc-500" style={{ top: `${computeBlockPosition(slotStart, slotStart + 1, window).topPercent}%` }}>
          {formatHour(slotStart)}
        </div>
      ))}

      {slots.map((slotStart) => (
        <HourSlot key={slotStart} slotStart={slotStart} window={window} />
      ))}

      {events.map((event) => {
        const { topPercent, heightPercent } = computeBlockPosition(event.startMinutes, event.endMinutes, window);
        return (
          <div
            key={event.id}
            style={{ top: `${topPercent}%`, height: `${heightPercent}%`, backgroundColor: event.color, left: "3.25rem" }}
            className="absolute right-1 overflow-hidden rounded-md px-2 py-0.5 text-xs text-white"
          >
            {event.title}
          </div>
        );
      })}
    </div>
  );
}
