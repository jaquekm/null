import { getUserTimezone } from "@/features/agenda/queries";
import { RotinaWorkspace } from "@/features/habits/components/rotina-workspace";
import { startOfWeek } from "@/features/habits/lib/habit-week";
import { listRotinaHabits } from "@/features/habits/queries";
import { requireOwner } from "@/lib/auth";
import { todayInTimezone } from "@/lib/dates";

export default async function RotinaPage({ searchParams }: PageProps<"/rotina">) {
  const { supabase, user } = await requireOwner();
  const timezone = await getUserTimezone(supabase, user.id);
  const today = todayInTimezone(timezone);
  const { semana } = await searchParams;
  const requested = typeof semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? startOfWeek(semana) : null;
  const weekStart = requested && requested <= startOfWeek(today) ? requested : startOfWeek(today);
  const { habits } = await listRotinaHabits(supabase, timezone);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Rotina</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {habits.length === 0 ? "Seus hábitos da semana, um toque pra marcar." : `${habits.length} ${habits.length === 1 ? "hábito" : "hábitos"} · um toque pra marcar`}
        </p>
      </header>
      <RotinaWorkspace habits={habits} today={today} weekStart={weekStart} />
    </div>
  );
}
