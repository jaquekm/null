import type { JSONContent } from "@tiptap/core";

/** Títulos que marcam a seção de tarefas numa nota de reunião. */
const NEXT_STEPS_HEADING = /pr[oó]ximos passos|encaminhamentos|a[cç][oõ]es|tarefas|to-?dos?/i;

function textOf(node: JSONContent): string {
  let text = "";
  function walk(n: JSONContent) {
    if (typeof n.text === "string") text += n.text;
    if (n.type === "taskList") return;
    for (const child of n.content ?? []) walk(child);
  }
  for (const child of node.content ?? []) walk(child);
  return text.trim();
}

/**
 * Itens de checklist da seção "Próximos passos" (ou "Ações", "Tarefas",
 * "Encaminhamentos") de uma nota de reunião — viram tarefas mesmo sem
 * gravação/transcrição (9.3). Pula os já marcados e os vazios; para no
 * próximo título do mesmo nível ou maior.
 */
export function nextStepsFromContent(doc: JSONContent | null): string[] {
  const blocks = doc?.content ?? [];
  const steps: string[] = [];
  let level: number | null = null;
  for (const block of blocks) {
    if (block.type === "heading") {
      const blockLevel = Number(block.attrs?.level ?? 1);
      if (level !== null && blockLevel <= level) break;
      if (level === null && NEXT_STEPS_HEADING.test(textOf(block))) level = blockLevel;
      continue;
    }
    if (level === null || block.type !== "taskList") continue;
    for (const item of block.content ?? []) {
      if (item.type !== "taskItem" || item.attrs?.checked === true) continue;
      const text = textOf(item);
      if (text) steps.push(text);
    }
  }
  return steps;
}

export interface MeetingParticipant {
  name: string;
  phoneE164: string | null;
  email: string | null;
}

/** Mensagem pros participantes: nome da reunião, data (se tiver) e o link. */
export function meetingShareMessage(title: string, dateLabel: string | null, url: string): string {
  const name = title.trim() || "Reunião";
  return `Resumo da reunião “${name}”${dateLabel ? ` (${dateLabel})` : ""}: pauta, anotações e próximos passos neste link, sempre atualizado — ${url}`;
}

/** Link de WhatsApp pra um participante (só dígitos no número; sem número abre o WhatsApp pra escolher o contato). */
export function whatsappLink(phoneE164: string | null, message: string): string {
  return `https://wa.me/${(phoneE164 ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

/** Um e-mail só pra todos que têm e-mail. `null` quando ninguém tem. */
export function mailtoAll(participants: MeetingParticipant[], subject: string, message: string): string | null {
  const emails = participants.map((p) => p.email?.trim()).filter((email): email is string => Boolean(email));
  if (emails.length === 0) return null;
  return `mailto:${emails.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}
