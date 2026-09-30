import type { FieldDefinition } from "@/features/types/schemas";
import type { ViewFilter } from "@/features/views/schemas";
import type { AutomationAction, AutomationTrigger } from "../schemas";
import { describeScheduleRrule } from "./schedule-phrase";

/**
 * A automação inteira como uma frase em português (9.8): "Quando um item do
 * tipo Tarefa for criado em Trabalho, adicionar a tag “nova” e me avisar no
 * WhatsApp." — usada na lista e como prévia ao vivo no editor.
 */
export interface DescribeAutomationContext {
  typeName?: string | null;
  spaceName?: string | null;
  fields?: FieldDefinition[];
  /** Pra "mover para <espaço>". */
  spaces?: { id: string; name: string }[];
}

const STATUS_PHRASE: Record<string, string> = { inbox: "voltar pra Inbox", active: "virar ativo", archived: "for arquivado" };

function fieldLabel(key: string, fields: FieldDefinition[] | undefined): string {
  if (!key) return "um campo";
  return `“${fields?.find((field) => field.key === key)?.label ?? key}”`;
}

function subject(ctx: DescribeAutomationContext): string {
  const who = ctx.typeName ? `um item do tipo ${ctx.typeName}` : "um item";
  return ctx.spaceName ? `${who} em ${ctx.spaceName}` : who;
}

/** "30 minutos", "2 horas", "1 dia" */
export function durationPt(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs % 1440 === 0) return abs === 1440 ? "1 dia" : `${abs / 1440} dias`;
  if (abs % 60 === 0) return abs === 60 ? "1 hora" : `${abs / 60} horas`;
  return abs === 1 ? "1 minuto" : `${abs} minutos`;
}

function valueText(value: unknown): string {
  if (value === "{{today}}") return "hoje";
  if (typeof value === "string") {
    const offset = /^\{\{today([+-]\d+)d\}\}$/.exec(value);
    if (offset) {
      const days = Number(offset[1]);
      return days > 0 ? `daqui a ${days === 1 ? "1 dia" : `${days} dias`}` : `${days === -1 ? "1 dia" : `${-days} dias`} atrás`;
    }
    return value ? `“${value}”` : "vazio";
  }
  if (typeof value === "boolean") return value ? "sim" : "não";
  if (value === null || value === undefined) return "vazio";
  return String(value);
}

export function describeTrigger(trigger: AutomationTrigger, ctx: DescribeAutomationContext = {}): string {
  switch (trigger.type) {
    case "item_created":
      return `Quando ${subject(ctx)} for criado`;
    case "property_changed": {
      const to = trigger.to === undefined || trigger.to === "" ? "" : ` para ${valueText(trigger.to)}`;
      return `Quando o campo ${fieldLabel(trigger.field, ctx.fields)} de ${subject(ctx)} mudar${to}`;
    }
    case "status_changed":
      return `Quando ${subject(ctx)} ${STATUS_PHRASE[trigger.to] ?? `mudar pra “${trigger.to}”`}`;
    case "date_reached": {
      const field = fieldLabel(trigger.field, ctx.fields);
      if (trigger.offsetMinutes === 0) return `Quando chegar a data ${field} de ${subject(ctx)}`;
      if (trigger.offsetMinutes < 0) return `Quando faltar ${durationPt(trigger.offsetMinutes)} para a data ${field} de ${subject(ctx)}`;
      return `Quando passar ${durationPt(trigger.offsetMinutes)} da data ${field} de ${subject(ctx)}`;
    }
    case "no_activity":
      return `Quando ${subject(ctx)} ficar ${trigger.days === 1 ? "1 dia" : `${trigger.days} dias`} sem mudanças`;
    case "schedule": {
      const when = describeScheduleRrule(trigger.rrule);
      if (!when) return "Em um horário que se repete";
      return `${when.charAt(0).toUpperCase()}${when.slice(1)}`;
    }
    case "tag_added":
      return `Quando ${subject(ctx)} ganhar a tag “${trigger.tag}”`;
  }
}

export function describeActionPhrase(action: AutomationAction, ctx: DescribeAutomationContext = {}): string {
  switch (action.type) {
    case "set_property":
      return `mudar ${fieldLabel(action.field, ctx.fields)} para ${valueText(action.value)}`;
    case "add_tag":
      return `adicionar a tag “${action.tag}”`;
    case "remove_tag":
      return `tirar a tag “${action.tag}”`;
    case "move_to_space": {
      if (!action.spaceId) return "tirar do espaço";
      const space = ctx.spaces?.find((s) => s.id === action.spaceId);
      return space ? `mover para ${space.name}` : "mover para outro espaço";
    }
    case "create_item":
      return `criar “${action.title}”${action.parent ? " dentro dele" : action.linkToTrigger ? " ligado a ele" : ""}`;
    case "create_checklist":
      return `adicionar uma checklist com ${action.items.length === 1 ? "1 item" : `${action.items.length} itens`}`;
    case "create_reminder": {
      const when = action.offsetMinutes > 0 ? ` daqui a ${durationPt(action.offsetMinutes)}` : "";
      return action.recipient === "me" ? `me lembrar${when}` : `lembrar o contato de ${fieldLabel(action.field ?? "", ctx.fields)}${when}`;
    }
    case "notify_me":
      return action.channel === "whatsapp" ? "me avisar no WhatsApp" : "me avisar por notificação";
    case "create_bill":
      return `criar uma conta a ${action.direction === "payable" ? "pagar" : "receber"} em ${action.dueInDays === 1 ? "1 dia" : `${action.dueInDays} dias`}`;
    case "create_review_cards":
      return "criar flashcards dos itens ligados";
    case "call_webhook":
      return "chamar o webhook";
  }
}

function joinPt(values: string[]): string {
  return values.length <= 1 ? (values[0] ?? "") : `${values.slice(0, -1).join(", ")} e ${values.at(-1)}`;
}

export function describeAutomation(
  automation: { trigger: AutomationTrigger; conditions?: ViewFilter[]; actions: AutomationAction[] },
  ctx: DescribeAutomationContext = {},
): string {
  const conditions = automation.conditions?.length ?? 0;
  const onlyIf = conditions === 0 ? "" : conditions === 1 ? " (se a condição bater)" : ` (se as ${conditions} condições baterem)`;
  const actions = automation.actions.length > 0 ? joinPt(automation.actions.map((action) => describeActionPhrase(action, ctx))) : "…";
  return `${describeTrigger(automation.trigger, ctx)}${onlyIf}, ${actions}.`;
}
