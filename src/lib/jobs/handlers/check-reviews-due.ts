import { formatInTimeZone } from "date-fns-tz";
import { getStudyTypeIds, getReviewCounters, getStudySettings } from "@/features/study/queries";
import { getUserTimezone } from "@/features/reminders/queries";
import { notifyOwner } from "@/lib/messaging/notify-owner";
import type { Json } from "@/lib/supabase/database.types";
import type { JobHandler } from "../types";

/**
 * Job `check_reviews_due` (5.7, "push diário — horário configurável"): roda
 * de hora em hora (`job_schedules.interval_seconds = 3600`) mas só notifica
 * na hora escolhida pelo dono (`preferences.study.reviewPushHour`, padrão
 * 8h) — e no máximo uma vez por dia, via o carimbo
 * `preferences.study.lastReviewPushDate` (mesmo espírito do índice único de
 * `check_budgets`, só que aqui é por hora configurável, não por limiar).
 */
export const checkReviewsDue: JobHandler = async (job, { supabase }) => {
  const typeIds = await getStudyTypeIds(supabase);
  if (!typeIds) return { status: "done", result: { skipped: "pack_not_installed" } };

  const timezone = await getUserTimezone(supabase, job.owner_id);
  const settings = await getStudySettings(supabase, job.owner_id);
  const now = new Date();
  const currentHour = Number(formatInTimeZone(now, timezone, "H"));
  const todayKey = formatInTimeZone(now, timezone, "yyyy-MM-dd");

  if (currentHour !== settings.reviewPushHour) {
    return { status: "done", result: { skipped: "not_the_configured_hour" } };
  }

  const { data: settingsRow, error: settingsError } = await supabase.from("user_settings").select("preferences").eq("owner_id", job.owner_id).maybeSingle();
  if (settingsError) return { status: "retry", error: settingsError.message };

  const preferences = (settingsRow?.preferences as Record<string, unknown> | null) ?? {};
  const study = (preferences.study as Record<string, unknown> | undefined) ?? {};
  if (study.lastReviewPushDate === todayKey) {
    return { status: "done", result: { skipped: "already_sent_today" } };
  }

  const counters = await getReviewCounters(supabase, job.owner_id, now.toISOString());
  const pending = counters.new + counters.learning + counters.review;

  if (pending > 0) {
    await notifyOwner(job.owner_id, {
      title: "Revisão de flashcards",
      text: `Você tem ${pending} card${pending === 1 ? "" : "s"} pra revisar.`,
    });
  }

  const { error: updateError } = await supabase
    .from("user_settings")
    .upsert({ owner_id: job.owner_id, preferences: { ...preferences, study: { ...study, lastReviewPushDate: todayKey } } as unknown as Json }, { onConflict: "owner_id" });
  if (updateError) return { status: "retry", error: updateError.message };

  return { status: "done", result: { pending, notified: pending > 0 } };
};
