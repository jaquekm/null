"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import FullCalendar from "@fullcalendar/react";
import type { EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateItemProperty } from "@/features/items/actions";
import type { FieldDefinition } from "@/features/types/schemas";
import type { ViewItemRow } from "../queries";

const initialFieldState = { ok: true as const, data: null };

function toDateOnly(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Calendário (5.4): posiciona itens por um campo `date`/`datetime`
 * escolhido na visão (`dateField`); arrastar muda a data (reaproveita
 * `updateItemProperty`, mesmo padrão do Kanban). Reaproveita o FullCalendar
 * já usado em `/agenda` (3.6), mas só com uma fonte (os próprios itens).
 */
export function CalendarView({ rows: initialRows, dateField }: { rows: ViewItemRow[]; dateField: FieldDefinition }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [, startTransition] = useTransition();

  const events: EventInput[] = rows
    .filter((row) => typeof row.properties[dateField.key] === "string" && row.properties[dateField.key])
    .map((row) => ({
      id: row.id,
      title: row.title || "Sem título",
      start: row.properties[dateField.key] as string,
      allDay: dateField.type === "date",
      editable: true,
    }));

  const withoutDate = rows.length - events.length;

  function handleEventClick(arg: EventClickArg) {
    router.push(`/itens/${arg.event.id}`);
  }

  function handleEventDrop(arg: EventDropArg) {
    const row = rows.find((r) => r.id === arg.event.id);
    if (!row || !arg.event.start) return;

    const value = dateField.type === "date" ? toDateOnly(arg.event.start) : arg.event.start.toISOString();
    const formData = new FormData();
    formData.append("value", value);

    startTransition(async () => {
      const result = await updateItemProperty(row.id, dateField.key, row.updatedAt, initialFieldState, formData);
      if (!result.ok) {
        toast.error(result.error);
        arg.revert();
        return;
      }
      setRows((current) =>
        current.map((r) =>
          r.id === row.id
            ? { ...r, properties: { ...r.properties, [dateField.key]: value }, updatedAt: result.data?.updatedAt ?? r.updatedAt }
            : r,
        ),
      );
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {withoutDate > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {withoutDate} {withoutDate === 1 ? "item não aparece" : "itens não aparecem"} aqui por não ter &quot;{dateField.label}&quot; preenchido.
        </p>
      )}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
        buttonText={{ today: "Hoje", month: "Mês", week: "Semana" }}
        initialView="dayGridMonth"
        locale={ptBrLocale}
        height="auto"
        editable
        events={events}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
      />
    </div>
  );
}
