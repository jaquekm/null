"use client";

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createEvent, getEventForEdit, updateEvent } from "@/features/events/actions";
import { createMeetingNote } from "@/features/meeting-notes/actions";
import type { CalendarOption } from "../queries";
import { AttendeePicker } from "./attendee-picker";

interface Attendee {
  email: string;
  name: string;
}

type EventFormDialogProps = {
  calendars: CalendarOption[];
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
} & (
  | { mode: "create"; initialStart: Date; initialEnd: Date; initialAllDay: boolean }
  | { mode: "edit"; eventId: string; onDelete: () => void }
);

function splitLocal(instant: Date, timezone: string): { date: string; time: string } {
  return {
    date: formatInTimeZone(instant, timezone, "yyyy-MM-dd"),
    time: formatInTimeZone(instant, timezone, "HH:mm"),
  };
}

/** Diálogo de criar/editar evento (3.5/3.6) — mesmo formulário nos dois modos. */
export function EventFormDialog(props: EventFormDialogProps) {
  const { calendars, timezone, onClose, onSaved } = props;
  const router = useRouter();

  const [loading, setLoading] = useState(props.mode === "edit");
  const [meetingItemId, setMeetingItemId] = useState<string | null>(null);
  const [creatingNote, setCreatingNote] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [allDay, setAllDay] = useState(() => (props.mode === "create" ? props.initialAllDay : false));
  const [startDate, setStartDate] = useState(() => (props.mode === "create" ? splitLocal(props.initialStart, timezone).date : ""));
  const [startTime, setStartTime] = useState(() => (props.mode === "create" ? splitLocal(props.initialStart, timezone).time : ""));
  const [endDate, setEndDate] = useState(() => (props.mode === "create" ? splitLocal(props.initialEnd, timezone).date : ""));
  const [endTime, setEndTime] = useState(() => (props.mode === "create" ? splitLocal(props.initialEnd, timezone).time : ""));
  const [calendarId, setCalendarId] = useState(calendars.find((c) => c.isPrimary)?.id ?? calendars[0]?.id ?? "");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [addMeet, setAddMeet] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (props.mode === "create") return;

    let active = true;
    getEventForEdit(props.eventId).then((detail) => {
      if (!active) return;
      if (!detail) {
        toast.error("Evento não encontrado.");
        onClose();
        return;
      }
      setTitle(detail.title);
      setDescription(detail.description ?? "");
      setLocation(detail.location ?? "");
      setAllDay(detail.allDay);
      const start = splitLocal(new Date(detail.startsAt), timezone);
      const end = splitLocal(new Date(detail.endsAt), timezone);
      setStartDate(start.date);
      setStartTime(start.time);
      setEndDate(end.date);
      setEndTime(end.time);
      if (detail.calendarId) setCalendarId(detail.calendarId);
      setAttendees(detail.attendeeEmails.map((email) => ({ email, name: email })));
      setMeetingItemId(detail.itemId);
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMeetingNoteClick() {
    if (meetingItemId) {
      router.push(`/itens/${meetingItemId}`);
      return;
    }
    if (props.mode !== "edit") return;
    setCreatingNote(true);
    void createMeetingNote(props.eventId).then((result) => {
      setCreatingNote(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/itens/${result.data.itemId}`);
    });
  }

  function toInstant(date: string, time: string): Date {
    return allDay ? fromZonedTime(`${date}T00:00:00`, timezone) : fromZonedTime(`${date}T${time}:00`, timezone);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Dê um título ao evento.");
      return;
    }
    const startsAt = toInstant(startDate, allDay ? startDate : startTime ? startTime : "00:00").toISOString();
    const endsAt = toInstant(endDate, allDay ? endDate : endTime ? endTime : "00:00").toISOString();

    setPending(true);
    const result =
      props.mode === "create"
        ? await createEvent({
            calendarId,
            title,
            description: description || undefined,
            location: location || undefined,
            startsAt,
            endsAt,
            allDay,
            attendeeEmails: attendees.map((a) => a.email),
            addMeet,
          })
        : await updateEvent({
            eventId: props.eventId,
            title,
            description: description || undefined,
            location: location || undefined,
            startsAt,
            endsAt,
            allDay,
            attendeeEmails: attendees.map((a) => a.email),
          });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(props.mode === "create" ? "Evento criado." : "Evento atualizado.");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void handleSubmit(e)}
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">{props.mode === "create" ? "Novo evento" : "Editar evento"}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-zinc-500">Carregando…</p>
        ) : (
          <>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título"
              className="rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.16]"
            />

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
              Dia inteiro
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Início
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.16]"
                  />
                  {!allDay && (
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.16]"
                    />
                  )}
                </div>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Fim
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.16]"
                  />
                  {!allDay && (
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.16]"
                    />
                  )}
                </div>
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Calendário
              <select
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                className="rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.16]"
              >
                {calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </option>
                ))}
              </select>
            </label>

            <AttendeePicker attendees={attendees} onChange={setAttendees} />

            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Descrição
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.16]"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Local
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.16]"
              />
            </label>

            {props.mode === "create" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={addMeet} onChange={(e) => setAddMeet(e.target.checked)} />
                Adicionar Google Meet
              </label>
            )}

            {props.mode === "edit" && (
              <button
                type="button"
                onClick={handleMeetingNoteClick}
                disabled={creatingNote}
                className="self-start rounded-lg border border-black/[.12] px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]"
              >
                {creatingNote ? "Criando…" : meetingItemId ? "Abrir nota" : "Criar nota da reunião"}
              </button>
            )}

            <div className="flex items-center justify-between pt-1">
              {props.mode === "edit" ? (
                <button
                  type="button"
                  onClick={props.onDelete}
                  className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                >
                  Excluir
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
              >
                {pending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
