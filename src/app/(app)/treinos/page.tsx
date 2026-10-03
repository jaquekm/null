import { PageHelp } from "@/components/shared/page-help";
import { TreinosWorkspace } from "@/features/treinos/components/treinos-workspace";
import { getHeightCm, listWeeklyMeasures, listWorkoutPrograms, listWorkoutSessions } from "@/features/treinos/queries";
import { requireOwner } from "@/lib/auth";

export default async function TreinosPage() {
  const { supabase, user } = await requireOwner();
  const [programs, sessions, weekly, heightCm] = await Promise.all([
    listWorkoutPrograms(supabase, user.id),
    listWorkoutSessions(supabase, user.id),
    listWeeklyMeasures(supabase, user.id),
    getHeightCm(supabase, user.id),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Treinos</h1>
          <PageHelp topic="treinos" />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {sessions.length} {sessions.length === 1 ? "treino registrado" : "treinos registrados"}
          {programs.find((p) => p.active) ? ` · programa: ${programs.find((p) => p.active)!.name}` : ""}
        </p>
      </header>
      <TreinosWorkspace programs={programs} sessions={sessions} weekly={weekly} heightCm={heightCm} />
    </div>
  );
}
