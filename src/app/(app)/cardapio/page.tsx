import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getUserTimezone } from "@/features/agenda/queries";
import { startOfWeek } from "@/features/habits/lib/habit-week";
import { MenuGrid } from "@/features/meals/components/menu-grid";
import { getWeekPlan } from "@/features/meals/queries";
import { requireOwner } from "@/lib/auth";
import { addDaysToDateString, todayInTimezone } from "@/lib/dates";

/** Cardápio da semana (10.9) — aberto pelo link "Ver cardápio da semana" no card Refeições do Hoje. */
export default async function CardapioPage({ searchParams }: PageProps<"/cardapio">) {
  const { supabase, user } = await requireOwner();
  const timezone = await getUserTimezone(supabase, user.id);
  const today = todayInTimezone(timezone);
  const { semana } = await searchParams;

  const currentMonday = startOfWeek(today);
  const requested = typeof semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? startOfWeek(semana) : null;
  const weekStart = requested ?? currentMonday;
  const isCurrentWeek = weekStart === currentMonday;

  const plan = await getWeekPlan(supabase, user.id, weekStart);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Cardápio da semana</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">O que comer em cada dia — preenche sozinho, sem pressa.</p>
          <Link href="/receitas" className="text-sm font-medium text-brand-text hover:underline">
            Receitas
          </Link>
        </div>
        <nav aria-label="Semana" className="flex items-center gap-1">
          <Link
            href={`/cardapio?semana=${addDaysToDateString(weekStart, -7)}`}
            className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-black/[.05] dark:text-zinc-300 dark:hover:bg-white/[.06]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> Anterior
          </Link>
          <span className="px-2 text-sm font-medium text-black dark:text-zinc-50">{isCurrentWeek ? "Esta semana" : weekStart}</span>
          <Link
            href={`/cardapio?semana=${addDaysToDateString(weekStart, 7)}`}
            className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-black/[.05] dark:text-zinc-300 dark:hover:bg-white/[.06]"
          >
            Próxima <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </nav>
      </header>

      <MenuGrid key={weekStart} weekStart={weekStart} plan={plan} />
    </div>
  );
}
