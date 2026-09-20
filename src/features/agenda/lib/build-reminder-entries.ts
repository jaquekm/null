import { REMINDER_COLOR, type AgendaEntry } from "./agenda-entry";

export interface ReminderRowForAgenda {
  id: string;
  title: string;
  send_at: string;
}

/** Lembretes → `AgendaEntry` (3.6) — pontuais (sem `end`), levam pra `/lembretes` (3.8) se clicados. */
export function buildReminderEntries(reminders: ReminderRowForAgenda[]): AgendaEntry[] {
  return reminders.map((reminder) => ({
    id: `reminder:${reminder.id}`,
    title: reminder.title,
    start: reminder.send_at,
    end: null,
    allDay: false,
    color: REMINDER_COLOR,
    editable: false,
    kind: "reminder" as const,
    href: "/lembretes",
  }));
}
