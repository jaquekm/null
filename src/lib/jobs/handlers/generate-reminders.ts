import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildBillDueReminders,
  type BillDueRuleConfig,
  type BillForDueRule,
  type ContactForBillDueRule,
} from "@/features/reminders/lib/build-bill-due-reminders";
import {
  buildBirthdayReminders,
  type BirthdayRuleConfig,
  type ContactForBirthdayRule,
} from "@/features/reminders/lib/build-birthday-reminders";
import {
  buildEventBeforeReminders,
  type ContactForEventRule,
  type EventBeforeRuleConfig,
  type EventForRule,
} from "@/features/reminders/lib/build-event-before-reminders";
import {
  buildItemDateFieldReminders,
  type ItemDateFieldRuleConfig,
  type ItemForDateFieldRule,
} from "@/features/reminders/lib/build-item-date-field-reminders";
import { reconcileGeneratedReminders, type DesiredReminder } from "@/features/reminders/lib/reconcile-generated-reminders";
import { getUserTimezone } from "@/features/reminders/queries";
import { serverEnv } from "@/lib/env";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { JobHandler } from "../types";

type Client = SupabaseClient<Database>;

const WINDOW_DAYS = 30;

interface RuleRow {
  id: string;
  kind: string;
  config: Json;
  channel: string;
  recipient_type: string;
  message_template: string;
}

async function buildDesiredForRule(supabase: Client, ownerId: string, rule: RuleRow, timezone: string, now: Date, windowEnd: Date): Promise<DesiredReminder[]> {
  const config = (rule.config ?? {}) as Record<string, unknown>;

  if (rule.kind === "event_before") {
    const [{ data: events }, { data: contacts }] = await Promise.all([
      supabase
        .from("events")
        .select("id, title, starts_at, status, attendees, item_id, conference_url")
        .eq("owner_id", ownerId)
        .gte("starts_at", now.toISOString())
        .lte("starts_at", windowEnd.toISOString()),
      supabase.from("contacts").select("id, email, relationship, whatsapp_opt_in, email_opt_in").eq("owner_id", ownerId).is("archived_at", null),
    ]);
    return buildEventBeforeReminders(
      (events ?? []) as EventForRule[],
      (contacts ?? []) as ContactForEventRule[],
      { id: rule.id, recipientType: rule.recipient_type, channel: rule.channel, messageTemplate: rule.message_template, config: config as EventBeforeRuleConfig },
      timezone,
      now,
      serverEnv.APP_URL,
    );
  }

  if (rule.kind === "birthday") {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, name, nickname, birthday")
      .eq("owner_id", ownerId)
      .is("archived_at", null)
      .not("birthday", "is", null);
    return buildBirthdayReminders(
      (contacts ?? []) as ContactForBirthdayRule[],
      { id: rule.id, channel: rule.channel, messageTemplate: rule.message_template, config: config as BirthdayRuleConfig },
      timezone,
      now,
    );
  }

  if (rule.kind === "item_date_field") {
    const typeId = (config as ItemDateFieldRuleConfig).typeId;
    if (!typeId) return [];
    const { data: items } = await supabase.from("items").select("id, title, type_id, properties").eq("owner_id", ownerId).eq("type_id", typeId).is("deleted_at", null);
    return buildItemDateFieldReminders(
      (items ?? []) as ItemForDateFieldRule[],
      { id: rule.id, channel: rule.channel, messageTemplate: rule.message_template, config: config as ItemDateFieldRuleConfig },
      timezone,
      now,
      serverEnv.APP_URL,
    );
  }

  if (rule.kind === "bill_due") {
    const [{ data: bills }, { data: recurring }, { data: contacts }] = await Promise.all([
      supabase.from("fin_bills").select("id, description, direction, amount_cents, due_on, status, contact_id, recurring_id").eq("owner_id", ownerId).in("status", ["open", "partial"]),
      supabase.from("fin_recurring").select("id, remind_days_before").eq("owner_id", ownerId),
      supabase.from("contacts").select("id, whatsapp_opt_in, email_opt_in").eq("owner_id", ownerId).is("archived_at", null),
    ]);
    const remindDaysBeforeByRecurringId = new Map(
      (recurring ?? []).filter((r) => r.remind_days_before != null).map((r) => [r.id, r.remind_days_before as number]),
    );
    return buildBillDueReminders(
      (bills ?? []) as BillForDueRule[],
      (contacts ?? []) as ContactForBillDueRule[],
      remindDaysBeforeByRecurringId,
      { id: rule.id, recipientType: rule.recipient_type, channel: rule.channel, messageTemplate: rule.message_template, config: config as BillDueRuleConfig },
      timezone,
      now,
    );
  }

  return []; // 'split_open' é 4.9; kind desconhecido também não gera nada
}

/**
 * Job `generate_reminders` (3.10, a cada 15 min e depois de `calendar_sync`):
 * pra cada regra ativa, recalcula as fontes elegíveis nos próximos 30 dias
 * (`buildEventBeforeReminders`/`buildBirthdayReminders`/`buildItemDateFieldReminders`,
 * puras e testadas) e reconcilia com o que já existe (`reconcileGeneratedReminders`,
 * também pura) — o job só executa o resultado do diff (`insert`/`update`/`cancel`
 * em `reminders`), a decisão em si já veio pronta.
 */
export const generateReminders: JobHandler = async (job, { supabase }) => {
  const { data: rules, error: rulesError } = await supabase
    .from("reminder_rules")
    .select("id, kind, config, channel, recipient_type, message_template")
    .eq("owner_id", job.owner_id)
    .eq("enabled", true);
  if (rulesError) return { status: "retry", error: rulesError.message };
  if (!rules || rules.length === 0) return { status: "done", result: { rulesProcessed: 0 } };

  const timezone = await getUserTimezone(supabase, job.owner_id);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

  let inserted = 0;
  let updated = 0;
  let canceled = 0;
  const errors: string[] = [];

  for (const rule of rules) {
    try {
      const desired = await buildDesiredForRule(supabase, job.owner_id, rule, timezone, now, windowEnd);

      const { data: existingRows, error: existingError } = await supabase
        .from("reminders")
        .select("id, source_type, source_id, status, send_at")
        .eq("owner_id", job.owner_id)
        .eq("rule_id", rule.id);
      if (existingError) throw new Error(existingError.message);

      const existing = (existingRows ?? [])
        .filter((row) => row.source_type && row.source_id)
        .map((row) => ({ id: row.id, sourceType: row.source_type as string, sourceId: row.source_id as string, status: row.status, sendAt: row.send_at }));

      const result = reconcileGeneratedReminders(desired, existing);

      if (result.toInsert.length > 0) {
        const { error: insertError } = await supabase.from("reminders").insert(
          result.toInsert.map((item) => ({
            owner_id: job.owner_id,
            title: item.title,
            message_template: item.messageTemplate,
            channel: item.channel,
            recipient_type: item.recipientType,
            contact_ids: item.contactIds,
            send_at: item.sendAt,
            timezone,
            source_type: item.sourceType,
            source_id: item.sourceId,
            rule_id: rule.id,
            item_id: item.itemId,
            variables: item.variables as unknown as Json,
          })),
        );
        if (insertError) throw new Error(insertError.message);
        inserted += result.toInsert.length;
      }

      for (const update of result.toUpdate) {
        const { error: updateError } = await supabase
          .from("reminders")
          .update({
            send_at: update.sendAt,
            variables: update.variables as unknown as Json,
            contact_ids: update.contactIds,
            ...(update.status ? { status: update.status } : {}),
          })
          .eq("id", update.id);
        if (updateError) throw new Error(updateError.message);
        updated += 1;
      }

      if (result.toCancel.length > 0) {
        const { error: cancelError } = await supabase.from("reminders").update({ status: "canceled" }).in("id", result.toCancel);
        if (cancelError) throw new Error(cancelError.message);
        canceled += result.toCancel.length;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Falha ao processar a regra ${rule.id}.`);
    }
  }

  if (errors.length > 0) return { status: "retry", error: errors.join("; ") };
  return { status: "done", result: { rulesProcessed: rules.length, inserted, updated, canceled } };
};
