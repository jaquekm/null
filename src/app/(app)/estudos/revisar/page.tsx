import { formatInTimeZone } from "date-fns-tz";
import Link from "next/link";
import { ReviewSession, type QueuedCard } from "@/features/study/components/review-session";
import { ReviewStats } from "@/features/study/components/review-stats";
import { formatFsrsInterval } from "@/features/study/lib/format-interval";
import { previewGrades } from "@/features/study/lib/fsrs";
import { buildReviewQueue } from "@/features/study/lib/review-queue";
import { computeAccuracyRate, computeForecast, computeReviewsPerDay } from "@/features/study/lib/study-stats";
import {
  countNewCardsReviewedToday,
  ensureReviewPushSchedule,
  getReviewCounters,
  getStudySettings,
  getStudyStatsData,
  getStudyTypeIds,
  listDeckCandidates,
  listReviewQueueCards,
} from "@/features/study/queries";
import { getUserTimezone } from "@/features/reminders/queries";
import { requireOwner } from "@/lib/auth";

export default async function RevisarPage(props: PageProps<"/estudos/revisar">) {
  const { supabase, user } = await requireOwner();
  const searchParams = await props.searchParams;
  const deckItemId = typeof searchParams.baralho === "string" ? searchParams.baralho : null;

  const typeIds = await getStudyTypeIds(supabase);
  if (!typeIds) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Revisar</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          O pack &quot;Estudos&quot; ainda não está instalado. Instale em{" "}
          <Link href="/configuracoes/metodos" className="text-black underline dark:text-zinc-50">
            Configurações → Métodos
          </Link>{" "}
          pra criar flashcards e revisar aqui.
        </p>
      </div>
    );
  }

  await ensureReviewPushSchedule(supabase, user.id);

  const timezone = await getUserTimezone(supabase, user.id);
  const now = new Date();

  const [{ due, new: newCards }, settings, newAlreadyShownToday, counters, decks, statsData] = await Promise.all([
    listReviewQueueCards(supabase, user.id, now.toISOString(), deckItemId),
    getStudySettings(supabase, user.id),
    countNewCardsReviewedToday(supabase, user.id, timezone),
    getReviewCounters(supabase, user.id, now.toISOString()),
    listDeckCandidates(supabase, typeIds),
    getStudyStatsData(supabase, user.id, timezone),
  ]);

  const queued = buildReviewQueue(due, newCards, { dailyNewLimit: settings.dailyNewCardLimit, newAlreadyShownToday });
  const initialQueue: QueuedCard[] = queued.map((card) => ({
    cardId: card.cardId,
    itemId: card.itemId,
    title: card.title,
    front: card.front,
    back: card.back,
    deckTitle: card.deckTitle,
    previews: previewGrades(card.fsrs, now).map((preview) => ({ grade: preview.grade, label: preview.label, intervalLabel: formatFsrsInterval(preview.dueAt, now) })),
  }));

  const todayKey = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const accuracyPercent = computeAccuracyRate(statsData.accuracyLogs);
  const reviewsPerDay = computeReviewsPerDay(statsData.reviewsPerDayLogs, todayKey, 30);
  const forecast = computeForecast(statsData.forecastDueDateKeys, todayKey, 30);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Revisar</h1>
        <Link href="/estudos" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          ← Painel de estudos
        </Link>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">
          Novos: <strong className="text-black dark:text-zinc-50">{counters.new}</strong>
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">
          Aprendendo: <strong className="text-black dark:text-zinc-50">{counters.learning}</strong>
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">
          Revisão: <strong className="text-black dark:text-zinc-50">{counters.review}</strong>
        </span>
      </div>

      {decks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Link
            href="/estudos/revisar"
            className={`rounded-full border px-3 py-1 ${!deckItemId ? "border-black bg-black text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-black" : "border-black/[.12] text-zinc-600 dark:border-white/[.16] dark:text-zinc-300"}`}
          >
            Todos
          </Link>
          {decks.map((deck) => (
            <Link
              key={deck.id}
              href={`/estudos/revisar?baralho=${deck.id}`}
              className={`rounded-full border px-3 py-1 ${deckItemId === deck.id ? "border-black bg-black text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-black" : "border-black/[.12] text-zinc-600 dark:border-white/[.16] dark:text-zinc-300"}`}
            >
              {deck.title}
            </Link>
          ))}
        </div>
      )}

      <ReviewSession initialQueue={initialQueue} />

      <details className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
        <summary className="cursor-pointer text-sm font-medium text-black dark:text-zinc-50">Estatísticas</summary>
        <div className="mt-3">
          <ReviewStats accuracyPercent={accuracyPercent} reviewsPerDay={reviewsPerDay} forecast={forecast} />
        </div>
      </details>
    </div>
  );
}
