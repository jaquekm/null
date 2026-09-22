import Link from "next/link";
import { GenerateFlashcardsDialog } from "@/features/study/components/generate-flashcards-dialog";
import { ImportAnkiDialog } from "@/features/study/components/import-anki-dialog";
import { NewFlashcardButton } from "@/features/study/components/new-flashcard-button";
import { StudySettingsForm } from "@/features/study/components/study-settings-form";
import { StudyTimer } from "@/features/study/components/study-timer";
import { getStudyDashboardData, getStudySettings, getStudyTypeIds } from "@/features/study/queries";
import { getUserTimezone } from "@/features/reminders/queries";
import { requireOwner } from "@/lib/auth";

export default async function EstudosPage() {
  const { supabase, user } = await requireOwner();

  const typeIds = await getStudyTypeIds(supabase);
  if (!typeIds) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Estudos</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          O pack &quot;Estudos&quot; ainda não está instalado. Instale em{" "}
          <Link href="/configuracoes/metodos" className="text-black underline dark:text-zinc-50">
            Configurações → Métodos
          </Link>{" "}
          pra organizar planos, cursos, livros e flashcards.
        </p>
      </div>
    );
  }

  const timezone = await getUserTimezone(supabase, user.id);
  const [data, settings] = await Promise.all([getStudyDashboardData(supabase, user.id, timezone, typeIds), getStudySettings(supabase, user.id)]);
  const hoursThisWeek = Math.round((data.minutesThisWeek / 60) * 10) / 10;
  const weeklyTarget = data.plans.reduce((sum, plan) => sum + (plan.weeklyHoursTarget ?? 0), 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Estudos</h1>
        <Link href="/espacos" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          Ver planos, cursos e livros →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Horas essa semana"
          value={`${hoursThisWeek}h`}
          sub={weeklyTarget > 0 ? `meta: ${weeklyTarget}h` : "sem meta definida"}
        />
        <StatCard label="Sequência" value={`${data.streakDays}`} sub={data.streakDays === 1 ? "dia seguido" : "dias seguidos"} />
        <StatCard label="Revisões pendentes" value={String(data.pendingReviews)} sub="cards" />
        <Link href="/estudos/revisar" className="flex flex-col justify-center rounded-lg border border-black/[.08] p-3 text-center dark:border-white/[.08]">
          <span className="text-sm font-medium text-black dark:text-zinc-50">Revisar agora →</span>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <NewFlashcardButton spaceId={null} />
        <GenerateFlashcardsDialog spaceId={null} />
        <ImportAnkiDialog spaceId={null} />
      </div>

      <StudyTimer itemId={null} />

      {data.coursesInProgress.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Cursos em andamento</h2>
          <ul className="flex flex-col gap-1.5">
            {data.coursesInProgress.map((course) => (
              <li key={course.id} className="flex items-center gap-3 text-sm">
                <Link href={`/itens/${course.id}`} className="flex-1 truncate hover:underline">
                  {course.title}
                </Link>
                <div className="h-1.5 w-24 overflow-hidden rounded bg-black/[.06] dark:bg-white/[.08]">
                  <div className="h-full rounded bg-black/70 dark:bg-white/70" style={{ width: `${course.progress}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right text-xs text-zinc-400 dark:text-zinc-500">{course.progress}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.booksReading.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Lendo agora</h2>
          <ul className="flex flex-col gap-1.5">
            {data.booksReading.map((book) => (
              <li key={book.id} className="flex items-center justify-between text-sm">
                <Link href={`/itens/${book.id}`} className="truncate hover:underline">
                  {book.title}
                </Link>
                <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                  {book.currentPage != null ? `p. ${book.currentPage}${book.pages ? ` de ${book.pages}` : ""}` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <StudySettingsForm initial={settings} />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-lg font-semibold text-black dark:text-zinc-50">{value}</p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500">{sub}</p>
    </div>
  );
}
