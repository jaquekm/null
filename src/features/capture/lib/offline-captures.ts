import { isReminderRequest } from "@/features/reminders/lib/parse-reminder-phrase";

/**
 * Capturas sem internet (9.9): o texto fica guardado no aparelho (IndexedDB,
 * `offline-capture-db.ts`) e é enviado quando a conexão volta. Aqui só a
 * regra — quem guarda/lê e quem chama o servidor entram como dependências,
 * pra dar pra testar sem navegador.
 */
export interface QueuedCapture {
  id: string;
  text: string;
  spaceId: string | null;
  typeId: string | null;
  /** Quando foi escrita — "daqui a 2 horas" conta a partir daqui, não de quando sincronizou. */
  createdAt: string;
}

type ActionResult = { ok: true } | { ok: false; error: string };

export interface FlushDeps {
  list: () => Promise<QueuedCapture[]>;
  remove: (id: string) => Promise<void>;
  capture: (text: string, spaceId: string | null, typeId: string | null) => Promise<ActionResult>;
  createReminder: (input: { phrase: string; referenceAt: string }) => Promise<ActionResult>;
}

export interface FlushResult {
  captured: number;
  reminders: number;
  /** Continuam guardadas (servidor recusou mesmo sem espaço/tipo) — aparecem de novo na próxima tentativa. */
  kept: number;
  /** A rede caiu no meio: parou e tenta de novo depois. */
  interrupted: boolean;
}

/** Erro de rede de verdade (fetch falhou), não um "não deu" do servidor. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return error instanceof TypeError || (error instanceof Error && /fetch|network|Failed to fetch|Load failed/i.test(error.message));
}

/**
 * Envia a fila, da mais antiga pra mais nova. "Me lembra de…" tenta virar
 * lembrete (com o relógio de quando foi escrito); se não der mais (o horário
 * já passou), entra como nota — nunca se perde. Se o espaço/tipo escolhido
 * sumiu nesse meio-tempo, vai pro Inbox.
 */
export async function flushOfflineCaptures(deps: FlushDeps): Promise<FlushResult> {
  const result: FlushResult = { captured: 0, reminders: 0, kept: 0, interrupted: false };
  const queue = [...(await deps.list())].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const entry of queue) {
    try {
      if (isReminderRequest(entry.text)) {
        const reminder = await deps.createReminder({ phrase: entry.text, referenceAt: entry.createdAt });
        if (reminder.ok) {
          await deps.remove(entry.id);
          result.reminders += 1;
          continue;
        }
      }

      let saved = await deps.capture(entry.text, entry.spaceId, entry.typeId);
      if (!saved.ok && (entry.spaceId || entry.typeId)) saved = await deps.capture(entry.text, null, null);
      if (saved.ok) {
        await deps.remove(entry.id);
        result.captured += 1;
      } else {
        result.kept += 1;
      }
    } catch (error) {
      if (isNetworkError(error)) {
        result.interrupted = true;
        break;
      }
      result.kept += 1;
    }
  }
  return result;
}

export function pendingCapturesLabel(count: number): string {
  return count === 1 ? "1 captura esperando internet" : `${count} capturas esperando internet`;
}

/** Aviso depois de enviar a fila. `null` quando não mandou nada. */
export function flushSummary(result: FlushResult): string | null {
  const parts: string[] = [];
  if (result.captured > 0) parts.push(result.captured === 1 ? "1 captura" : `${result.captured} capturas`);
  if (result.reminders > 0) parts.push(result.reminders === 1 ? "1 lembrete" : `${result.reminders} lembretes`);
  if (parts.length === 0) return null;
  return `Internet de volta — enviei ${parts.join(" e ")} feitos sem conexão.`;
}
