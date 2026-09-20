"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateCalendarSync } from "../actions";
import type { ConnectionCalendar } from "../queries";

export function CalendarRow({
  calendar,
  spaces,
}: {
  calendar: ConnectionCalendar;
  spaces: { id: string; name: string }[];
}) {
  const [syncEnabled, setSyncEnabled] = useState(calendar.syncEnabled);
  const [spaceId, setSpaceId] = useState(calendar.spaceId ?? "");
  const [pending, startTransition] = useTransition();

  function handleSyncChange(checked: boolean) {
    setSyncEnabled(checked);
    startTransition(async () => {
      const result = await updateCalendarSync({ calendarId: calendar.id, syncEnabled: checked });
      if (!result.ok) {
        setSyncEnabled(!checked);
        toast.error(result.error);
      }
    });
  }

  function handleSpaceChange(value: string) {
    setSpaceId(value);
    startTransition(async () => {
      const result = await updateCalendarSync({ calendarId: calendar.id, spaceId: value || null });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="flex items-center gap-2 truncate">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: calendar.color ?? "#a1a1aa" }}
          aria-hidden
        />
        <span className="truncate text-black dark:text-zinc-50">{calendar.name}</span>
        {calendar.isPrimary && (
          <span className="shrink-0 rounded-full bg-black/[.06] px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-white/[.08] dark:text-zinc-300">
            principal
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <select
          value={spaceId}
          disabled={pending}
          onChange={(e) => handleSpaceChange(e.target.value)}
          aria-label={`Espaço do calendário ${calendar.name}`}
          className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs text-black dark:border-white/[.08] dark:text-zinc-50"
        >
          <option value="">Sem espaço</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
        <input
          type="checkbox"
          checked={syncEnabled}
          disabled={pending}
          onChange={(e) => handleSyncChange(e.target.checked)}
          aria-label={`Sincronizar ${calendar.name}`}
        />
      </div>
    </div>
  );
}
