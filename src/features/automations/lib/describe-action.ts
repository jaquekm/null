import type { AutomationAction } from "../schemas";
import { resolveTemplateValue } from "./resolve-template";

export interface DescribeActionItem {
  title: string;
  properties: Record<string, unknown>;
}

/** Texto legível do que uma ação faria (5.3: "Testar com item…" — só descreve, não aplica). */
export function describeAction(action: AutomationAction, item: DescribeActionItem, today: Date = new Date()): string {
  switch (action.type) {
    case "set_property": {
      const value = resolveTemplateValue(action.value, { today, item });
      return `Definir "${action.field}" = ${JSON.stringify(value)}`;
    }
    case "add_tag":
      return `Adicionar a tag "${action.tag}"`;
    case "remove_tag":
      return `Remover a tag "${action.tag}"`;
    case "move_to_space":
      return action.spaceId ? "Mover pra outro espaço" : "Tirar do espaço (deixar sem espaço)";
    case "create_item": {
      const title = resolveTemplateValue(action.title, { today, item });
      const extras = [action.linkToTrigger && "vinculado a este item", action.parent && "como subitem deste"].filter(Boolean).join(", ");
      return `Criar item "${title}"${extras ? ` (${extras})` : ""}`;
    }
    case "create_checklist":
      return `Adicionar checklist com ${action.items.length} item(ns): ${action.items.join(", ")}`;
    case "create_reminder":
      return `Criar lembrete (${action.recipient === "me" ? "pra você" : "pro contato do campo"}): "${action.message}"`;
    case "notify_me": {
      const title = resolveTemplateValue(action.title, { today, item });
      return `Notificar você: "${title}"`;
    }
    case "create_bill":
      return `Criar conta a ${action.direction === "payable" ? "pagar" : "receber"}: "${action.description}"`;
    case "create_review_cards":
      return "Criar flashcards de revisão a partir dos itens ligados";
    case "call_webhook":
      return `Chamar o webhook ${action.url}`;
    default: {
      const exhaustive: never = action;
      return `Ação desconhecida: ${String((exhaustive as { type?: string })?.type)}`;
    }
  }
}
