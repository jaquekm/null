import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { computeDayRange } from "@/features/agenda/lib/day-range";
import type { Database } from "@/lib/supabase/database.types";
import type { ReviewCardFsrsRow } from "./lib/fsrs";
import { computeStreak } from "./lib/streak";
import { DEFAULT_STUDY_SETTINGS, type StudySettings } from "./schemas";

type Client = SupabaseClient<Database>;

const STUDY_SLUGS = {
  plan: "plano-de-estudo",
  course: "curso",
  book: "livro",
  source: "fonte",
  note: "nota-de-estudo",
  flashcard: "flashcard",
} as const;

export interface StudyTypeIds {
  planTypeId: string | null;
  courseTypeId: string | null;
  bookTypeId: string | null;
  sourceTypeId: string | null;
  noteTypeId: string | null;
  flashcardTypeId: string;
}

/** Os tipos do pack Estudos (5.7) não têm id fixo — nascem na instalação. `null` = pack não instalado ainda. */
export async function getStudyTypeIds(supabase: Client): Promise<StudyTypeIds | null> {
  const { data, error } = await supabase.from("object_types").select("id, slug").in("slug", Object.values(STUDY_SLUGS));
  if (error) throw error;

  const idBySlug = new Map((data ?? []).map((row) => [row.slug, row.id]));
  const flashcardTypeId = idBySlug.get(STUDY_SLUGS.flashcard);
  if (!flashcardTypeId) return null;

  return {
    planTypeId: idBySlug.get(STUDY_SLUGS.plan) ?? null,
    courseTypeId: idBySlug.get(STUDY_SLUGS.course) ?? null,
    bookTypeId: idBySlug.get(STUDY_SLUGS.book) ?? null,
    sourceTypeId: idBySlug.get(STUDY_SLUGS.source) ?? null,
    noteTypeId: idBySlug.get(STUDY_SLUGS.note) ?? null,
    flashcardTypeId,
  };
}

/**
 * Agenda o job `check_reviews_due` (5.7) pro dono, se ainda não existir —
 * mesmo padrão "garante na primeira visita de verdade" do `ensureCanvas`/
 * `ensureCanvasType` (5.5), só que pra uma linha de `job_schedules` em vez
 * de um tipo/registro. Chamado a partir da página `/estudos` (server
 * component), não de uma migration/seed — `job_schedules.owner_id` só pode
 * ser preenchido quando já existe uma sessão de verdade (mesma observação
 * já registrada na 1.3/4.8 pros outros jobs).
 */
export async function ensureReviewPushSchedule(supabase: Client, ownerId: string): Promise<void> {
  await supabase.from("job_schedules").upsert({ kind: "check_reviews_due", owner_id: ownerId, interval_seconds: 60 * 60, enabled: true }, { onConflict: "kind" });
}

export async function getStudySettings(supabase: Client, ownerId: string): Promise<StudySettings> {
  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle();
  const preferences = (data?.preferences as Record<string, unknown> | null) ?? {};
  const stored = (preferences.study as Partial<StudySettings> | undefined) ?? {};
  return {
    dailyNewCardLimit: typeof stored.dailyNewCardLimit === "number" ? stored.dailyNewCardLimit : DEFAULT_STUDY_SETTINGS.dailyNewCardLimit,
    reviewPushHour: typeof stored.reviewPushHour === "number" ? stored.reviewPushHour : DEFAULT_STUDY_SETTINGS.reviewPushHour,
  };
}

export interface ReviewCounters {
  new: number;
  learning: number;
  review: number;
}

export async function getReviewCounters(supabase: Client, ownerId: string, nowIso: string): Promise<ReviewCounters> {
  const { data, error } = await supabase.from("review_cards").select("state").eq("owner_id", ownerId).eq("suspended", false).lte("due_at", nowIso);
  if (error) throw error;

  const counters: ReviewCounters = { new: 0, learning: 0, review: 0 };
  for (const row of data ?? []) {
    if (row.state === "new") counters.new += 1;
    else if (row.state === "learning" || row.state === "relearning") counters.learning += 1;
    else counters.review += 1;
  }
  return counters;
}

export interface ReviewQueueCard {
  cardId: string;
  itemId: string;
  title: string;
  front: string;
  back: string;
  deckItemId: string | null;
  deckTitle: string | null;
  fsrs: ReviewCardFsrsRow;
}

async function resolveDeckTitles(supabase: Client, deckItemIds: string[]): Promise<Map<string, string>> {
  if (deckItemIds.length === 0) return new Map();
  const { data, error } = await supabase.from("items").select("id, title").in("id", deckItemIds);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.id, row.title || "Sem título"]));
}

/** Cards vencidos (`due_at <= agora`, não suspensos), já separados `new` de `due` (5.7: fila da revisão respeita o limite diário só nos novos). */
export async function listReviewQueueCards(
  supabase: Client,
  ownerId: string,
  nowIso: string,
  deckItemId?: string | null,
): Promise<{ due: ReviewQueueCard[]; new: ReviewQueueCard[] }> {
  let query = supabase
    .from("review_cards")
    .select(
      "id, item_id, deck_item_id, state, due_at, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, last_review_at, items!review_cards_item_id_fkey(title, properties)",
    )
    .eq("owner_id", ownerId)
    .eq("suspended", false)
    .lte("due_at", nowIso)
    .order("due_at", { ascending: true });
  if (deckItemId) query = query.eq("deck_item_id", deckItemId);

  const { data, error } = await query;
  if (error) throw error;

  const deckTitles = await resolveDeckTitles(supabase, [...new Set((data ?? []).map((row) => row.deck_item_id).filter((id): id is string => Boolean(id)))]);

  const due: ReviewQueueCard[] = [];
  const news: ReviewQueueCard[] = [];
  for (const row of data ?? []) {
    const item = row.items as { title: string | null; properties: unknown } | null;
    const properties = (item?.properties as Record<string, unknown> | null) ?? {};
    const card: ReviewQueueCard = {
      cardId: row.id,
      itemId: row.item_id,
      title: item?.title || "Sem título",
      front: typeof properties.front === "string" ? properties.front : "",
      back: typeof properties.back === "string" ? properties.back : "",
      deckItemId: row.deck_item_id,
      deckTitle: row.deck_item_id ? (deckTitles.get(row.deck_item_id) ?? null) : null,
      fsrs: {
        state: row.state,
        due_at: row.due_at,
        stability: row.stability,
        difficulty: row.difficulty,
        elapsed_days: row.elapsed_days,
        scheduled_days: row.scheduled_days,
        reps: row.reps,
        lapses: row.lapses,
        last_review_at: row.last_review_at,
      },
    };
    if (row.state === "new") news.push(card);
    else due.push(card);
  }
  return { due, new: news };
}

/** Quantos cards `new` já foram avaliados hoje (fuso do dono) — pro limite diário configurável. */
export async function countNewCardsReviewedToday(supabase: Client, ownerId: string, timezone: string): Promise<number> {
  const { startIso } = computeDayRange(new Date(), timezone);
  const { count, error } = await supabase
    .from("review_logs")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("state_before", "new")
    .gte("reviewed_at", startIso);
  if (error) throw error;
  return count ?? 0;
}

export interface DeckCandidate {
  id: string;
  title: string;
  typeLabel: "Plano" | "Curso" | "Livro";
}

/** Itens que podem ser baralho de um Flashcard (5.7: `deck` → Plano/Curso/Livro) — pro seletor ao criar/importar. */
export async function listDeckCandidates(supabase: Client, typeIds: StudyTypeIds): Promise<DeckCandidate[]> {
  const entries: [string | null, DeckCandidate["typeLabel"]][] = [
    [typeIds.planTypeId, "Plano"],
    [typeIds.courseTypeId, "Curso"],
    [typeIds.bookTypeId, "Livro"],
  ];
  const validEntries = entries.filter((entry): entry is [string, DeckCandidate["typeLabel"]] => Boolean(entry[0]));
  if (validEntries.length === 0) return [];

  const results = await Promise.all(
    validEntries.map(([typeId]) => supabase.from("items").select("id, title").eq("type_id", typeId).eq("status", "active").is("deleted_at", null)),
  );

  const candidates: DeckCandidate[] = [];
  results.forEach((result, index) => {
    const [, typeLabel] = validEntries[index]!;
    for (const row of result.data ?? []) candidates.push({ id: row.id, title: row.title || "Sem título", typeLabel });
  });
  return candidates.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

export interface FlashcardSides {
  itemId: string;
  front: string;
  back: string;
}

export async function getFlashcardSides(supabase: Client, ownerId: string, itemId: string): Promise<FlashcardSides | null> {
  const { data, error } = await supabase.from("items").select("id, properties").eq("id", itemId).eq("owner_id", ownerId).maybeSingle();
  if (error || !data) return null;
  const properties = (data.properties as Record<string, unknown> | null) ?? {};
  return {
    itemId: data.id,
    front: typeof properties.front === "string" ? properties.front : "",
    back: typeof properties.back === "string" ? properties.back : "",
  };
}

export async function getItemContentText(supabase: Client, ownerId: string, itemId: string): Promise<{ title: string; contentText: string } | null> {
  const { data, error } = await supabase.from("items").select("title, content_text").eq("id", itemId).eq("owner_id", ownerId).maybeSingle();
  if (error || !data) return null;
  return { title: data.title || "Sem título", contentText: data.content_text ?? "" };
}

export interface StudyStatsData {
  accuracyLogs: { rating: number }[];
  reviewsPerDayLogs: { dateKey: string; rating: number }[];
  forecastDueDateKeys: string[];
}

/** Dados brutos pras estatísticas da página de revisão (5.7: taxa de acerto, revisões por dia, previsão 30 dias) — as contas ficam em `lib/study-stats.ts`. */
export async function getStudyStatsData(supabase: Client, ownerId: string, timezone: string): Promise<StudyStatsData> {
  const [logsResult, forecastResult] = await Promise.all([
    supabase.from("review_logs").select("rating, reviewed_at").eq("owner_id", ownerId).order("reviewed_at", { ascending: false }).limit(2000),
    supabase.from("review_cards").select("due_at").eq("owner_id", ownerId).eq("suspended", false),
  ]);
  if (logsResult.error) throw logsResult.error;
  if (forecastResult.error) throw forecastResult.error;

  const accuracyLogs = (logsResult.data ?? []).map((row) => ({ rating: row.rating }));
  const reviewsPerDayLogs = (logsResult.data ?? []).map((row) => ({
    dateKey: formatInTimeZone(new Date(row.reviewed_at), timezone, "yyyy-MM-dd"),
    rating: row.rating,
  }));
  const forecastDueDateKeys = (forecastResult.data ?? []).map((row) => formatInTimeZone(new Date(row.due_at), timezone, "yyyy-MM-dd"));

  return { accuracyLogs, reviewsPerDayLogs, forecastDueDateKeys };
}

export interface StudyDashboardCourse {
  id: string;
  title: string;
  progress: number;
}

export interface StudyDashboardBook {
  id: string;
  title: string;
  currentPage: number | null;
  pages: number | null;
}

export interface StudyDashboardPlan {
  id: string;
  title: string;
  weeklyHoursTarget: number | null;
}

export interface StudyDashboardData {
  minutesThisWeek: number;
  plans: StudyDashboardPlan[];
  streakDays: number;
  coursesInProgress: StudyDashboardCourse[];
  booksReading: StudyDashboardBook[];
  pendingReviews: number;
}

async function listActiveDateKeys(supabase: Client, ownerId: string, timezone: string): Promise<string[]> {
  const { data, error } = await supabase.from("study_sessions").select("started_at").eq("owner_id", ownerId).order("started_at", { ascending: false }).limit(400);
  if (error) throw error;
  return [...new Set((data ?? []).map((row) => formatInTimeZone(new Date(row.started_at), timezone, "yyyy-MM-dd")))];
}

export async function getStudyDashboardData(supabase: Client, ownerId: string, timezone: string, typeIds: StudyTypeIds): Promise<StudyDashboardData> {
  const now = new Date();
  const todayKey = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const weekAgoIso = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();

  const [sessionsResult, plansResult, coursesResult, booksResult, reviewCounters, activeDateKeys] = await Promise.all([
    supabase.from("study_sessions").select("duration_minutes").eq("owner_id", ownerId).gte("started_at", weekAgoIso),
    typeIds.planTypeId
      ? supabase.from("items").select("id, title, properties").eq("type_id", typeIds.planTypeId).eq("status", "active").is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    typeIds.courseTypeId
      ? supabase.from("items").select("id, title, properties").eq("type_id", typeIds.courseTypeId).eq("status", "active").is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    typeIds.bookTypeId
      ? supabase.from("items").select("id, title, properties").eq("type_id", typeIds.bookTypeId).eq("status", "active").is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    getReviewCounters(supabase, ownerId, now.toISOString()),
    listActiveDateKeys(supabase, ownerId, timezone),
  ]);
  if (sessionsResult.error) throw sessionsResult.error;

  const minutesThisWeek = (sessionsResult.data ?? []).reduce((sum, row) => sum + (row.duration_minutes ?? 0), 0);

  const plans: StudyDashboardPlan[] = ((plansResult.data ?? []) as { id: string; title: string; properties: unknown }[])
    .filter((row) => (row.properties as Record<string, unknown>)?.status === "em_andamento")
    .map((row) => ({
      id: row.id,
      title: row.title || "Sem título",
      weeklyHoursTarget: numberOrNull((row.properties as Record<string, unknown>)?.weekly_hours_target),
    }));

  const coursesInProgress: StudyDashboardCourse[] = ((coursesResult.data ?? []) as { id: string; title: string; properties: unknown }[])
    .filter((row) => (row.properties as Record<string, unknown>)?.status === "fazendo")
    .map((row) => ({ id: row.id, title: row.title || "Sem título", progress: numberOrNull((row.properties as Record<string, unknown>)?.progress) ?? 0 }));

  const booksReading: StudyDashboardBook[] = ((booksResult.data ?? []) as { id: string; title: string; properties: unknown }[])
    .filter((row) => (row.properties as Record<string, unknown>)?.status === "lendo")
    .map((row) => ({
      id: row.id,
      title: row.title || "Sem título",
      currentPage: numberOrNull((row.properties as Record<string, unknown>)?.current_page),
      pages: numberOrNull((row.properties as Record<string, unknown>)?.pages),
    }));

  return {
    minutesThisWeek,
    plans,
    streakDays: computeStreak(activeDateKeys, todayKey),
    coursesInProgress,
    booksReading,
    pendingReviews: reviewCounters.new + reviewCounters.learning + reviewCounters.review,
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
