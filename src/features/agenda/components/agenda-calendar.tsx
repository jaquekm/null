"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput, EventSourceFuncArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { deleteEvent, updateEvent } from "@/features/events/actions";
import { fetchAgendaEvents, type AgendaSources } from "../actions";
import type { AgendaEntry, AgendaSourceKind } from "../lib/agenda-entry";
import type { CalendarOption } from "../queries";
import { EventFormDialog } from "./event-form-dialog";

type DialogState = { mode: "create"; start: Date; end: Date; allDay: boolean } | { mode: "edit"; eventId: string } | null;

function toEventInput(entry: AgendaEntry): EventInput {
  return {
    id: entry.id,
    title: entry.title,
    start: entry.start,
    end: entry.end ?? undefined,
    allDay: entry.allDay,
    backgroundColor: entry.color,
    borderColor: entry.color,
    editable: entry.editable,
    extendedProps: { kind: entry.kind, href: entry.href },
  };
}

/** `/agenda` (3.6): FullCalendar com as três fontes que já existem (eventos do Google, prazos de itens, lembretes). */
export function AgendaCalendar({ calendars, timezone }: { calendars: CalendarOption[]; timezone: string }) {
  const calendarRef = useRef<FullCalendar>(null);
  const sourcesRef = useRef<AgendaSources>({ events: true, items: true, reminders: true });
  const [sources, setSources] = useState<AgendaSources>({ events: true, items: true, reminders: true });
  const [dialog, setDialog] = useState<DialogState>(null);

  function toggleSource(kind: keyof AgendaSources) {
    const next = { ...sourcesRef.current, [kind]: !sourcesRef.current[kind] };
    sourcesRef.current = next;
    setSources(next);
    calendarRef.current?.getApi().refetchEvents();
  }

  function refetch() {
    calendarRef.current?.getApi().refetchEvents();
  }

  function handleSelect(selectInfo: DateSelectArg) {
    setDialog({ mode: "create", start: selectInfo.start, end: selectInfo.end, allDay: selectInfo.allDay });
    selectInfo.view.calendar.unselect();
  }

  function handleDateClick(arg: DateClickArg) {
    const end = new Date(arg.date.getTime() + (arg.allDay ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000));
    setDialog({ mode: "create", start: arg.date, end, allDay: arg.allDay });
  }

  function handleEventClick(arg: EventClickArg) {
    const kind = arg.event.extendedProps.kind as AgendaSourceKind;
    if (kind === "google-event") {
      setDialog({ mode: "edit", eventId: arg.event.id.replace(/^event:/, "") });
      return;
    }
    const href = arg.event.extendedProps.href as string | null;
    if (href) window.location.href = href;
  }

  function handleEventDrop(arg: EventDropArg) {
    handleReschedule(arg.event.id, arg.event.start, arg.event.end, () => arg.revert());
  }

  function handleEventResize(arg: EventResizeDoneArg) {
    handleReschedule(arg.event.id, arg.event.start, arg.event.end, () => arg.revert());
  }

  function handleReschedule(prefixedId: string, start: Date | null, end: Date | null, revert: () => void) {
    if (!start || !end) return;
    const eventId = prefixedId.replace(/^event:/, "");
    void updateEvent({ eventId, startsAt: start.toISOString(), endsAt: end.toISOString() }).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        revert();
      }
    });
  }

  async function handleDelete(eventId: string) {
    const result = await deleteEvent(eventId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDialog(null);
    refetch();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={sources.events} onChange={() => toggleSource("events")} />
          Eventos do Google
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={sources.items} onChange={() => toggleSource("items")} />
          Prazos de itens
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={sources.reminders} onChange={() => toggleSource("reminders")} />
          Lembretes
        </label>
      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" }}
        buttonText={{ today: "Hoje", month: "Mês", week: "Semana", day: "Dia", list: "Lista" }}
        initialView="timeGridWeek"
        locale={ptBrLocale}
        timeZone={timezone}
        height="auto"
        selectable
        editable
        select={handleSelect}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        events={(fetchInfo: EventSourceFuncArg) =>
          fetchAgendaEvents(fetchInfo.start.toISOString(), fetchInfo.end.toISOString(), sourcesRef.current).then((entries) =>
            entries.map(toEventInput),
          )
        }
      />

      {dialog?.mode === "create" && (
        <EventFormDialog
          mode="create"
          calendars={calendars}
          timezone={timezone}
          initialStart={dialog.start}
          initialEnd={dialog.end}
          initialAllDay={dialog.allDay}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            refetch();
          }}
        />
      )}
      {dialog?.mode === "edit" && (
        <EventFormDialog
          mode="edit"
          calendars={calendars}
          timezone={timezone}
          eventId={dialog.eventId}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            refetch();
          }}
          onDelete={() => void handleDelete(dialog.eventId)}
        />
      )}
    </div>
  );
}
