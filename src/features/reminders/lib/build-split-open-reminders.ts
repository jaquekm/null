import { formatBRL } from "@/lib/money";
import type { DesiredReminder } from "./reconcile-generated-reminders";

export interface SplitForOpenRule {
  id: string;
  title: string;
  created_at: string;
  status: string;
}

export interface ShareForOpenRule {
  id: string;
  split_id: string;
  /** `null` = minha parte. */
  contact_id: string | null;
  share_cents: number;
  settled_cents: number;
}

export interface ContactForSplitOpenRule {
  id: string;
  whatsapp_opt_in: boolean;
  email_opt_in: boolean;
}

export interface SplitOpenRuleConfig {
  /** Padrão 7 — "há X dias" e "no máximo a cada X dias" são o mesmo número (enunciado da 4.9). */
  everyDays?: number;
}

export interface SplitOpenRule {
  id: string;
  recipientType: string;
  channel: string;
  messageTemplate: string;
  config: SplitOpenRuleConfig;
}

const DEFAULT_EVERY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Regra "Divisão em aberto" (4.9, `kind='split_open'`) — igual `bill_due`,
 * uma regra com duas variantes por `recipientType`: "contacts" (contato com
 * parte em aberto e opt-in) e "me" (minha própria parte, quando quem pagou
 * foi um contato). Sem data de vencimento pra ancorar (diferente de
 * `bill_due`), o intervalo é medido a partir de `fin_splits.created_at`
 * (`fin_split_shares` não tem `created_at` próprio — nasce junto com a
 * divisão): o primeiro lembrete só depois de `everyDays` dias, e os
 * seguintes a cada `everyDays` dias enquanto a parte continuar em aberto —
 * `sendAt` cai sempre num múltiplo exato de `everyDays` a partir da
 * criação, então quando o valor recalculado mudar (nova janela), o
 * reconciliador (`reconcileGeneratedReminders`) reativa um lembrete já
 * `completed` sozinho, sem precisar de RRULE. `{{link}}` (link de
 * pagamento) fica vazio até a 4.10 existir, mesmo desvio já documentado em
 * `bill_due`.
 */
export function buildSplitOpenReminders(
  splits: SplitForOpenRule[],
  shares: ShareForOpenRule[],
  contacts: ContactForSplitOpenRule[],
  rule: SplitOpenRule,
  now: Date,
): DesiredReminder[] {
  const everyDays = rule.config.everyDays ?? DEFAULT_EVERY_DAYS;
  const everyMs = everyDays * DAY_MS;
  const splitById = new Map(splits.map((s) => [s.id, s]));
  const contactsById = new Map(contacts.map((c) => [c.id, c]));

  const desired: DesiredReminder[] = [];

  for (const share of shares) {
    const split = splitById.get(share.split_id);
    if (!split || split.status !== "open") continue;

    const remaining = share.share_cents - share.settled_cents;
    if (remaining <= 0) continue;

    const owner = share.contact_id;
    if (rule.recipientType === "me") {
      if (owner !== null) continue;
    } else {
      if (owner === null) continue;
      const contact = contactsById.get(owner);
      if (!contact || (!contact.whatsapp_opt_in && !contact.email_opt_in)) continue;
    }

    const createdAtMs = new Date(split.created_at).getTime();
    const elapsedMs = now.getTime() - createdAtMs;
    if (elapsedMs < everyMs) continue;

    const periodsElapsed = Math.floor(elapsedMs / everyMs);
    const sendAt = new Date(createdAtMs + periodsElapsed * everyMs);

    desired.push({
      sourceType: "split_open",
      sourceId: share.id,
      sendAt: sendAt.toISOString(),
      title: split.title,
      messageTemplate: rule.messageTemplate,
      channel: rule.channel,
      recipientType: rule.recipientType === "me" ? "me" : "contacts",
      contactIds: owner ? [owner] : [],
      variables: { valor: formatBRL(remaining), dias: String(Math.floor(elapsedMs / DAY_MS)) },
      itemId: null,
    });
  }

  return desired;
}
