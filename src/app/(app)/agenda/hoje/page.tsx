import Link from "next/link";
import { TodayPlanner } from "@/features/agenda/components/today-planner";
import { computeDayRange } from "@/features/agenda/lib/day-range";
import { buildGoogleEventEntries } from "@/features/agenda/lib/build-google-event-entries";
import { extractItemDateEntries } from "@/features/agenda/lib/extract-item-date-entries";
import { partitionTasksByDueness } from "@/features/agenda/lib/partition-tasks";
import { computeMinutesSinceMidnight, computeTimelineWindow } from "@/features/agenda/lib/timeline-layout";
import {
  getUserTimezone,
  listCalendarColors,
  listDateFieldsByTypeId,
  listGoogleEventsInRange,
  listItemsForDateExtraction,
  listRemindersInRange,
} from "@/features/agenda/queries";
import { listPinnedItems } from "@/features/items/queries";
import { requireOwner } from "@/lib/auth";

/** Sem limite inferior de verdade pro prazo — pega qualquer tarefa atrasada, por mais velha que seja. */
const FAR_PAST_ISO = "1970-01-01T00:00:00.000Z";

export default async function TodayPlannerPage() {
  const { supabase, user } = await requireOwner();
  const timezone = await getUserTimezone(supabase, user.id);
  const dayRange = computeDayRange(new Date(), timezone);

  const [events, calendarColors, dateFieldsByTypeId, reminders, pinned] = await Promise.all([
    listGoogleEventsInRange(supabase, user.id, dayRange.startIso, dayRange.endIsoExclusive),
    listCalendarColors(supabase, user.id),
    listDateFieldsByTypeId(supabase, user.id),
    listRemindersInRange(supabase, user.id, dayRange.startIso, dayRange.endIsoExclusive),
    listPinnedItems(supabase),
  ]);

  const items = await listItemsForDateExtraction(supabase, user.id, [...dateFieldsByTypeId.keys()]);
  const allTasks = extractItemDateEntries(items, dateFieldsByTypeId, FAR_PAST_ISO, dayRange.endIsoExclusive);
  const { overdue, dueToday } = partitionTasksByDueness(allTasks, dayRange.startIso);

  const eventEntries = buildGoogleEventEntries(events, calendarColors);
  const timelineEvents = eventEntries
    .filter((entry) => !entry.allDay)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      color: entry.color,
      startMinutes: computeMinutesSinceMidnight(entry.start, timezone),
      endMinutes: entry.end ? computeMinutesSinceMidnight(entry.end, timezone) : computeMinutesSinceMidnight(entry.start, timezone) + 30,
    }));
  const window = computeTimelineWindow(timelineEvents);

  return (
    <div className="flex flex-col gap-2">
      <div className="mx-auto flex w-full max-w-4xl justify-end px-6 pt-4">
        <Link href="/agenda" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          ← Agenda
        </Link>
      </div>
      <TodayPlanner
        dateStr={dayRange.dateStr}
        events={timelineEvents}
        window={window}
        overdueTasks={overdue}
        dueTodayTasks={dueToday}
        reminders={reminders}
        pinnedItems={pinned}
      />
    </div>
  );
}
