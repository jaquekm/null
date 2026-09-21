import { formatInTimeZone } from "date-fns-tz";
import { nextOccurrence } from "@/features/reminders/lib/recurrence";
import { getUserTimezone } from "@/features/reminders/queries";
import type { JobHandler } from "../types";

const HORIZON_DAYS = 60;

function toInstant(dateStr: string): Date {
  // meio-dia UTC evita que a conversão de fuso empurre a data pro dia anterior/seguinte perto da meia-noite.
  return new Date(`${dateStr}T12:00:00Z`);
}

interface RecurringRow {
  id: string;
  space_id: string | null;
  description: string;
  direction: "payable" | "receivable";
  amount_cents: number;
  category_id: string | null;
  account_id: string | null;
  contact_id: string | null;
  rrule: string;
  next_due_on: string;
  ends_on: string | null;
}

/**
 * Job `generate_bills` (4.8, diário): pra cada `fin_recurring` ativa, cria
 * `fin_bills` pra cada ocorrência entre `next_due_on` e 60 dias à frente
 * (`nextOccurrence`, mesma função da 3.8), avançando `next_due_on` até
 * passar do horizonte. O índice único parcial (`recurring_id, due_on`) faz
 * o próprio banco ignorar reprocessamento (`insert` cai em 23505, tratado
 * como "já existe", não como erro) — roda de novo sem duplicar.
 * `ends_on` estourado ou a RRULE esgotar (`COUNT`/`UNTIL`) desativa a
 * recorrência (`active=false`) em vez de tentar de novo pra sempre.
 */
export const generateBills: JobHandler = async (job, { supabase }) => {
  const { data: recurring, error } = await supabase
    .from("fin_recurring")
    .select("id, space_id, description, direction, amount_cents, category_id, account_id, contact_id, rrule, next_due_on, ends_on")
    .eq("owner_id", job.owner_id)
    .eq("active", true);
  if (error) return { status: "retry", error: error.message };
  if (!recurring || recurring.length === 0) return { status: "done", result: { created: 0 } };

  const timezone = await getUserTimezone(supabase, job.owner_id);
  const horizon = formatInTimeZone(new Date(Date.now() + HORIZON_DAYS * 24 * 60 * 60 * 1000), timezone, "yyyy-MM-dd");

  let created = 0;
  const errors: string[] = [];

  for (const rec of recurring as RecurringRow[]) {
    try {
      let cursor: string | null = rec.next_due_on;
      let ended = false;

      while (cursor && cursor <= horizon) {
        if (rec.ends_on && cursor > rec.ends_on) {
          ended = true;
          cursor = null;
          break;
        }

        const { error: insertError } = await supabase.from("fin_bills").insert({
          owner_id: job.owner_id,
          space_id: rec.space_id,
          direction: rec.direction,
          description: rec.description,
          contact_id: rec.contact_id,
          category_id: rec.category_id,
          account_id: rec.account_id,
          amount_cents: rec.amount_cents,
          due_on: cursor,
          recurring_id: rec.id,
        });
        if (insertError && insertError.code !== "23505") throw new Error(insertError.message);
        if (!insertError) created += 1;

        const following = nextOccurrence(rec.rrule, timezone, toInstant(cursor));
        cursor = following ? formatInTimeZone(following, timezone, "yyyy-MM-dd") : null;
        if (!cursor) ended = true;
      }

      const update: { next_due_on?: string; active?: boolean } = {};
      if (cursor) update.next_due_on = cursor;
      if (ended) update.active = false;
      if (Object.keys(update).length > 0) {
        const { error: updateError } = await supabase.from("fin_recurring").update(update).eq("id", rec.id);
        if (updateError) throw new Error(updateError.message);
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Falha ao gerar contas da recorrência ${rec.id}.`);
    }
  }

  if (errors.length > 0) return { status: "retry", error: errors.join("; ") };
  return { status: "done", result: { created } };
};
