import Link from "next/link";
import { getUserTimezone } from "@/features/agenda/queries";
import { RotinaWorkspace } from "@/features/habits/components/rotina-workspace";
import { startOfWeek } from "@/features/habits/lib/habit-week";
import { listRotinaHabits } from "@/features/habits/queries";
import { RoutineSchedule } from "@/features/routine/components/routine-schedule";
import { listRoutineBlocks } from "@/features/routine/queries";
import { requireOwner } from "@/lib/auth";
import { todayInTimezone } from "@/lib/dates";

function Tab({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-surface text-black shadow-sm dark:text-zinc-50" : "text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"}`}
    >
      {children}
    </Link>
  );
}

export default async function RotinaPage({ searchParams }: PageProps<"/rotina">) {
  const { supabase, user } = await requireOwner();
  const timezone = await getUserTimezone(supabase, user.id);
  const today = todayInTimezone(timezone);
  const { semana, ver } = await searchParams;
  const showSchedule = ver === "horarios";

  const header = (subtitle: string) => (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Rotina</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      </div>
      <nav aria-label="Rotina" className="flex gap-1 rounded-xl bg-black/[.05] p-1 dark:bg-white/[.06]">
        <Tab href="/rotina" active={!showSchedule}>
          Hábitos
        </Tab>
        <Tab href="/rotina?ver=horarios" active={showSchedule}>
          Horários
        </Tab>
      </nav>
    </header>
  );

  if (showSchedule) {
    const blocks = await listRoutineBlocks(supabase, user.id);
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
        {header(blocks.length === 0 ? "Seus horários fixos da semana." : `${blocks.length} ${blocks.length === 1 ? "bloco fixo" : "blocos fixos"} na semana`)}
        <RoutineSchedule blocks={blocks} today={today} />
      </div>
    );
  }

  const requested = typeof semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? startOfWeek(semana) : null;
  const weekStart = requested && requested <= startOfWeek(today) ? requested : startOfWeek(today);
  const { habits } = await listRotinaHabits(supabase, timezone);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      {header(habits.length === 0 ? "Seus hábitos da semana, um toque pra marcar." : `${habits.length} ${habits.length === 1 ? "hábito" : "hábitos"} · um toque pra marcar`)}
      <RotinaWorkspace habits={habits} today={today} weekStart={weekStart} />
    </div>
  );
}
