import { formatInTimeZone } from "date-fns-tz";
import { buildGoogleEventEntries } from "@/features/agenda/lib/build-google-event-entries";
import { computeDayRange } from "@/features/agenda/lib/day-range";
import { extractItemDateEntries } from "@/features/agenda/lib/extract-item-date-entries";
import { partitionTasksByDueness } from "@/features/agenda/lib/partition-tasks";
import {
  getUserTimezone,
  listCalendarColors,
  listDateFieldsByTypeId,
  listGoogleEventsInRange,
  listItemsForDateExtraction,
  listRemindersInRange,
} from "@/features/agenda/queries";
import { expiryStatus } from "@/features/documents/lib/expiry";
import { listExpiringItems } from "@/features/documents/queries";
import { listBills } from "@/features/financas/queries";
import { linkActivityLabel } from "@/features/sharing/lib/link-activity";
import { listUnreadLinkActivity } from "@/features/sharing/queries";
import { countInboxItems, listRecentItems } from "@/features/items/queries";
import { TodayView, type TodayRow } from "@/features/today/components/today-view";
import { billsDueSoon, daySummary, formatDayHeader, formatTime, greeting } from "@/features/today/lib/today";
import { findWorkout } from "@/features/treinos/lib/program";
import { nextWorkout } from "@/features/treinos/lib/rules";
import { listWorkoutPrograms, listWorkoutSessions } from "@/features/treinos/queries";
import { describeBlockTime, formatHour, routineNow } from "@/features/routine/lib/routine-blocks";
import { listRoutineBlocks } from "@/features/routine/queries";
import { requireOwner } from "@/lib/auth";
import { formatBRL } from "@/lib/money";

/** Sem limite inferior pro prazo — pega qualquer tarefa atrasada, por mais velha que seja (igual ao planejador do dia). */
const FAR_PAST_ISO = "1970-01-01T00:00:00.000Z";
/** Quantos prazos mostrar de cada grupo (atrasados / de hoje) antes do "e mais…". */
const TASKS_SHOWN = 6;

/** Página inicial "Hoje": busca o dia de cada módulo e entrega pronto pra `TodayView`. */
export default async function TodayPage() {
  const { supabase, user } = await requireOwner();
  const timezone = await getUserTimezone(supabase, user.id);
  const now = new Date();
  const dayRange = computeDayRange(now, timezone);
  const today = dayRange.dateStr;

  const [events, calendarColors, dateFieldsByTypeId, reminders, bills, inboxCount, recent, programs, sessions, expiringItems, linkActivity, routineBlocks] = await Promise.all([
    listGoogleEventsInRange(supabase, user.id, dayRange.startIso, dayRange.endIsoExclusive),
    listCalendarColors(supabase, user.id),
    listDateFieldsByTypeId(supabase, user.id),
    listRemindersInRange(supabase, user.id, dayRange.startIso, dayRange.endIsoExclusive),
    // Um módulo com problema não derruba a página inicial inteira — o cartão dele só fica vazio.
    listBills(supabase, { tab: "payable" }, today).catch(() => []),
    countInboxItems(supabase),
    listRecentItems(supabase, 6),
    listWorkoutPrograms(supabase, user.id).catch(() => []),
    listWorkoutSessions(supabase, user.id).catch(() => []),
    listExpiringItems(supabase, today).catch(() => []),
    listUnreadLinkActivity(supabase, 6).catch(() => ({ items: [], total: 0 })),
    listRoutineBlocks(supabase, user.id).catch(() => []),
  ]);

  const items = await listItemsForDateExtraction(supabase, user.id, [...dateFieldsByTypeId.keys()]);
  const { overdue, dueToday } = partitionTasksByDueness(
    extractItemDateEntries(items, dateFieldsByTypeId, FAR_PAST_ISO, dayRange.endIsoExclusive),
    dayRange.startIso,
  );

  const agenda: TodayRow[] = buildGoogleEventEntries(events, calendarColors)
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start))
    .map((entry) => ({ id: entry.id, title: entry.title, href: entry.href, lead: entry.allDay ? "dia todo" : formatTime(entry.start, timezone) }));
  const reminderRows: TodayRow[] = [...reminders]
    .sort((a, b) => a.send_at.localeCompare(b.send_at))
    .map((reminder) => ({ id: reminder.id, title: reminder.title, href: "/lembretes", lead: formatTime(reminder.send_at, timezone) }));
  const tasks: TodayRow[] = [
    ...overdue.slice(0, TASKS_SHOWN).map((task) => ({ id: task.id, title: task.title, href: task.href, meta: "atrasado", danger: true })),
    ...dueToday.slice(0, TASKS_SHOWN).map((task) => ({ id: task.id, title: task.title, href: task.href, meta: "hoje" })),
  ];
  const dueBills = billsDueSoon(bills, today);
  const billRows: TodayRow[] = dueBills.slice(0, 6).map((bill) => ({
    id: bill.id,
    title: `${bill.description} · ${formatBRL(bill.remainingCents)}`,
    href: "/financas/contas",
    meta: bill.dueLabel,
    danger: bill.overdue,
  }));

  const expiring: TodayRow[] = expiringItems.slice(0, 6).map((doc) => {
    const status = expiryStatus(doc.expiry, today);
    return { id: doc.id, title: doc.title, href: `/itens/${doc.id}`, meta: status.label, danger: status.level === "expired" || status.level === "today" };
  });

  const linkRows: TodayRow[] = linkActivity.items.map((activity) => ({
    id: activity.id,
    title: linkActivityLabel(activity),
    href: activity.itemId ? `/itens/${activity.itemId}` : null,
    // Hoje: a hora; antes disso: o dia.
    meta:
      new Date(activity.createdAt).toLocaleDateString("en-CA", { timeZone: timezone }) === today
        ? formatTime(activity.createdAt, timezone)
        : new Date(activity.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: timezone }),
  }));

  const program = programs.find((p) => p.active);
  const letter = program ? nextWorkout(program.definition, sessions) : null;
  const workout =
    program && letter ? { done: sessions.some((s) => s.date === today), letter, name: findWorkout(program.definition, letter)?.name ?? null } : null;

  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(now));

  const nowRoutine = routineNow(routineBlocks, today, formatInTimeZone(now, timezone, "HH:mm"));
  const routine = {
    current: nowRoutine.current ? `${nowRoutine.current.title} (${describeBlockTime(nowRoutine.current)})` : null,
    next: nowRoutine.next ? `${formatHour(nowRoutine.next.start)} ${nowRoutine.next.title}` : null,
  };

  return (
    <TodayView
      dateLabel={formatDayHeader(today)}
      hello={greeting(hour)}
      summary={daySummary({ events: agenda.length, reminders: reminderRows.length, tasks: overdue.length + dueToday.length, bills: dueBills.length })}
      agenda={agenda}
      reminders={reminderRows}
      tasks={tasks}
      hiddenTasks={overdue.length + dueToday.length - tasks.length}
      bills={billRows}
      expiring={expiring}
      linkActivity={linkRows}
      hiddenLinkActivity={linkActivity.total - linkRows.length}
      workout={workout}
      recent={recent.map((item) => ({ id: item.id, title: item.title, href: `/itens/${item.id}` }))}
      inboxCount={inboxCount}
      routine={routine}
    />
  );
}
