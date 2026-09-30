import { eventAlertLabel, type EventAlertState } from "@/features/reminders/lib/event-alert";
import type { ReminderRuleInput } from "@/features/reminders/schemas";
import type { AutomationAction, AutomationInput } from "../schemas";
import { scheduleFromPhrase } from "./schedule-phrase";

/**
 * Receitas prontas (9.8): automações escritas como frase, ativadas com um
 * toque. Não são um motor novo — cada receita monta uma coisa que já existe:
 * - `reminder_rule`: regra automática de lembrete (3.10: contas, aniversários,
 *   divisões), marcada com `config.recipe` pra reconhecer depois;
 * - `event_alert`: o "me avisar antes de cada evento" da Agenda (9.4);
 * - `automation`: automação de item/horário (5.3), marcada com
 *   `pack_key = "recipe:<chave>"`.
 */

export const RECIPE_CHANNELS = ["push", "whatsapp", "email"] as const;
export type RecipeChannel = (typeof RECIPE_CHANNELS)[number];

export const RECIPE_CHANNEL_LABELS: Record<RecipeChannel, string> = { push: "por notificação", whatsapp: "no WhatsApp", email: "por e-mail" };
export const RECIPE_CHANNEL_SHORT: Record<RecipeChannel, string> = { push: "Notificação", whatsapp: "WhatsApp", email: "E-mail" };

export const RECIPE_KEYS = [
  "conta-a-pagar",
  "cobrar-conta-a-receber",
  "minha-parte-divisao",
  "aviso-evento",
  "aniversarios",
  "tag-urgente",
  "revisao-semanal",
] as const;
export type RecipeKey = (typeof RECIPE_KEYS)[number];

export const RECIPE_CATEGORIES = ["Contas", "Agenda", "Pessoas", "Itens", "Rotina"] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

interface RecipeBase {
  key: RecipeKey;
  category: RecipeCategory;
  /** Canais que a dona escolhe; vazio = canal fixo (ex.: cobrança usa o preferido de cada contato). */
  channels: RecipeChannel[];
  /** A frase, com o canal escolhido. */
  sentence: (channel: RecipeChannel | null, state?: RecipeState) => string;
  /** Detalhe curto embaixo da frase (opcional). */
  hint?: string;
}

export type RecipeRuleTemplate = Omit<ReminderRuleInput, "channel" | "enabled">;

export type Recipe =
  | (RecipeBase & { engine: "reminder_rule"; rule: RecipeRuleTemplate })
  | (RecipeBase & { engine: "event_alert"; minutesBefore: number })
  | (RecipeBase & { engine: "automation"; build: (channel: RecipeChannel, now: Date, timezone: string) => AutomationInput });

const channelText = (channel: RecipeChannel | null) => (channel ? ` ${RECIPE_CHANNEL_LABELS[channel]}` : "");

function notifyAction(title: string, body: string, channel: RecipeChannel): AutomationAction {
  return { type: "notify_me", title, body, ...(channel === "whatsapp" ? { channel: "whatsapp" as const } : {}) };
}

export const RECIPES: Recipe[] = [
  {
    key: "conta-a-pagar",
    category: "Contas",
    engine: "reminder_rule",
    channels: ["push", "whatsapp", "email"],
    sentence: (channel) => `Quando uma conta a pagar vencer amanhã, me avisar${channelText(channel)} — e de novo no dia`,
    rule: {
      name: "Contas a pagar — véspera",
      kind: "bill_due",
      recipientType: "me",
      messageTemplate: "💸 Conta a pagar: {{titulo}}, {{valor}}, vence {{data}}.",
      config: { daysBefore: 1 },
    },
  },
  {
    key: "cobrar-conta-a-receber",
    category: "Contas",
    engine: "reminder_rule",
    channels: [],
    sentence: () => "Quando uma conta a receber estiver pra vencer, lembrar quem me deve — na véspera e no dia seguinte",
    hint: "Só manda pra quem aceitou receber mensagens, pelo canal preferido de cada contato.",
    rule: {
      name: "Cobrança de contas a receber",
      kind: "bill_due",
      recipientType: "contacts",
      messageTemplate: "Oi {{nome}}! Passando pra lembrar: {{titulo}}, {{valor}}, vence {{data}}. {{link}}",
      config: { daysBefore: 1 },
    },
  },
  {
    key: "minha-parte-divisao",
    category: "Contas",
    engine: "reminder_rule",
    channels: ["push", "whatsapp", "email"],
    sentence: (channel) => `Enquanto minha parte de uma divisão estiver em aberto, me lembrar a cada 7 dias${channelText(channel)}`,
    rule: {
      name: "Minha parte em aberto",
      kind: "split_open",
      recipientType: "me",
      messageTemplate: "Lembrete: {{titulo}} está em aberto há {{dias}} dias — sua parte é {{valor}}.",
      config: { everyDays: 7 },
    },
  },
  {
    key: "aviso-evento",
    category: "Agenda",
    engine: "event_alert",
    channels: ["push", "whatsapp", "email"],
    minutesBefore: 30,
    sentence: (channel, state) => {
      const label = eventAlertLabel(state?.minutesBefore ?? 30);
      return `${label.charAt(0).toUpperCase()}${label.slice(1)} de cada compromisso da agenda, me avisar${channelText(channel)}`;
    },
    hint: "O tempo muda na Agenda.",
  },
  {
    key: "aniversarios",
    category: "Pessoas",
    engine: "reminder_rule",
    channels: ["push"],
    sentence: (channel) => `No aniversário de um contato, me avisar${channelText(channel)} com uma mensagem pronta pra mandar`,
    rule: {
      name: "Aniversários",
      kind: "birthday",
      recipientType: "me",
      messageTemplate: "Parabéns, {{nome}}! Tudo de bom nesse novo ano de vida. 🎉",
      config: { sendToContact: false },
    },
  },
  {
    key: "tag-urgente",
    category: "Itens",
    engine: "automation",
    channels: ["push", "whatsapp"],
    sentence: (channel) => `Quando eu puser a tag “urgente” em um item, me avisar${channelText(channel)}`,
    build: (channel) => ({
      name: "Tag “urgente” → me avisar",
      enabled: true,
      spaceId: null,
      typeId: null,
      trigger: { type: "tag_added", tag: "urgente" },
      conditions: [],
      actions: [notifyAction("🔥 Urgente", "{{title}}", channel)],
    }),
  },
  {
    key: "revisao-semanal",
    category: "Rotina",
    engine: "automation",
    channels: ["push", "whatsapp"],
    sentence: (channel) => `Toda sexta às 17h, me lembrar da revisão da semana${channelText(channel)}`,
    hint: "Dá pra mudar o dia e a hora em “Ajustar”.",
    build: (channel, now, timezone) => {
      const schedule = scheduleFromPhrase("toda sexta às 17h", now, timezone);
      if (!schedule.ok) throw new Error(schedule.error); // frase fixa — não falha
      return {
        name: "Revisão da semana",
        enabled: true,
        spaceId: null,
        typeId: null,
        trigger: { type: "schedule", rrule: schedule.rrule, timezone },
        conditions: [],
        actions: [notifyAction("🗓️ Revisão da semana", "Hora de revisar a semana: o que ficou pra trás e o que vem aí.", channel)],
      };
    },
  },
];

export function getRecipe(key: string): Recipe | null {
  return RECIPES.find((recipe) => recipe.key === key) ?? null;
}

export const recipePackKey = (key: RecipeKey) => `recipe:${key}`;

// ---------- estado (ativa? em qual canal?) ----------

export interface RecipeState {
  active: boolean;
  channel: RecipeChannel | null;
  /** Regra/automação por trás da receita (pra "Ajustar"). */
  sourceId: string | null;
  /** Só `aviso-evento`: o tempo configurado na Agenda. */
  minutesBefore?: number | null;
}

export interface RecipeRuleRow {
  id: string;
  kind: string;
  recipient_type: string;
  channel: string;
  enabled: boolean;
  config: unknown;
  created_at: string;
}

export interface RecipeAutomationRow {
  id: string;
  enabled: boolean;
  pack_key: string | null;
  actions: unknown;
  created_at: string;
}

function toRecipeChannel(value: unknown, allowed: RecipeChannel[]): RecipeChannel | null {
  if (allowed.length === 0) return null;
  const channel = value === "whatsapp" || value === "email" || value === "push" ? value : "push"; // "auto" pra mim = push
  return allowed.includes(channel) ? channel : (allowed[0] ?? null);
}

/** A regra de uma receita: a mais antiga com `config.recipe` igual (a que o toque liga/desliga). */
export function findRecipeRule(rules: RecipeRuleRow[], key: RecipeKey): RecipeRuleRow | null {
  return (
    [...rules]
      .filter((rule) => (rule.config as { recipe?: unknown } | null)?.recipe === key)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null
  );
}

export function findRecipeAutomation(automations: RecipeAutomationRow[], key: RecipeKey): RecipeAutomationRow | null {
  return (
    [...automations].filter((automation) => automation.pack_key === recipePackKey(key)).sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null
  );
}

/** Estado de cada receita a partir do que está no banco. */
export function recipeStates(input: { rules: RecipeRuleRow[]; automations: RecipeAutomationRow[]; eventAlert: EventAlertState }): Record<RecipeKey, RecipeState> {
  const states = {} as Record<RecipeKey, RecipeState>;
  for (const recipe of RECIPES) {
    if (recipe.engine === "reminder_rule") {
      const rule = findRecipeRule(input.rules, recipe.key);
      states[recipe.key] = {
        active: rule?.enabled ?? false,
        channel: toRecipeChannel(rule?.channel, recipe.channels),
        sourceId: rule?.id ?? null,
      };
    } else if (recipe.engine === "event_alert") {
      states[recipe.key] = {
        active: input.eventAlert.minutesBefore !== null,
        channel: toRecipeChannel(input.eventAlert.channel, recipe.channels),
        sourceId: input.eventAlert.ruleId,
        minutesBefore: input.eventAlert.minutesBefore,
      };
    } else {
      const automation = findRecipeAutomation(input.automations, recipe.key);
      const notify = ((automation?.actions ?? []) as AutomationAction[]).find((action) => action.type === "notify_me");
      states[recipe.key] = {
        active: automation?.enabled ?? false,
        channel: toRecipeChannel(notify && notify.type === "notify_me" ? (notify.channel ?? "push") : null, recipe.channels),
        sourceId: automation?.id ?? null,
      };
    }
  }
  return states;
}

/** Troca o canal das ações "me avisar" de uma automação de receita, mantendo o resto (ex.: horário ajustado pela dona). */
export function withNotifyChannel(actions: AutomationAction[], channel: RecipeChannel): AutomationAction[] {
  return actions.map((action) => {
    if (action.type !== "notify_me") return action;
    const { channel: _previous, ...rest } = action;
    return channel === "whatsapp" ? { ...rest, channel: "whatsapp" } : rest;
  });
}
