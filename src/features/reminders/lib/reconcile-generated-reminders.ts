export interface DesiredReminder {
  sourceType: string;
  sourceId: string;
  sendAt: string;
  title: string;
  messageTemplate: string;
  channel: string;
  recipientType: string;
  contactIds: string[];
  variables: Record<string, string>;
  itemId: string | null;
}

export interface ExistingGeneratedReminder {
  id: string;
  sourceType: string;
  sourceId: string;
  status: string;
  sendAt: string;
}

export interface ReminderUpdate {
  id: string;
  sendAt: string;
  variables: Record<string, string>;
  contactIds: string[];
  /** Só presente quando reativa um lembrete `completed` cuja fonte passou a apontar pra uma ocorrência nova. */
  status?: "scheduled";
}

export interface ReconcileResult {
  toInsert: DesiredReminder[];
  toUpdate: ReminderUpdate[];
  toCancel: string[];
}

function sourceKey(sourceType: string, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

/**
 * Diff genérico entre o que uma regra (3.10) quer que exista agora
 * (`desired`, recalculado a cada ciclo do job `generate_reminders`) e o que
 * já existe no banco pra essa mesma regra (`existing`). Segue o enunciado ao
 * pé da letra — "se a fonte mudou de horário, atualizar `send_at`; se foi
 * cancelada, cancelar" — sem tratar `completed` como estado permanentemente
 * intocável: uma fonte que **recorre** (aniversário no ano seguinte, prazo
 * de tarefa adiado pra uma data nova) tem o mesmo `source_id` de sempre —
 * se o `send_at` calculado agora for diferente do que already foi enviado,
 * é uma ocorrência nova, e o lembrete reativa (`status` volta pra
 * `scheduled`). `canceled`, por outro lado, é a palavra final do dono: uma
 * vez cancelado à mão, a regra nunca mais mexe nesse lembrete.
 * - fonte nova (sem lembrete ainda) → cria.
 * - fonte com lembrete `scheduled`/`paused` → atualiza `send_at`/
 *   `variables`/`contactIds` (nunca `message_template`/`title`/`channel` —
 *   preserva edição manual do dono no lembrete gerado), sem mexer no status.
 * - fonte com lembrete `completed` e `send_at` igual ao que já tinha →
 *   não mexe (é a mesma ocorrência, já resolvida).
 * - fonte com lembrete `completed` mas `send_at` diferente → reativa
 *   (`status: "scheduled"` + novo `send_at`) — é uma ocorrência nova.
 * - fonte com lembrete `canceled` → nunca mexe, de jeito nenhum.
 * - lembrete `scheduled`/`paused` cuja fonte sumiu do `desired` (evento
 *   cancelado, contato sem opt-in mais, etc.) → cancela.
 */
export function reconcileGeneratedReminders(desired: DesiredReminder[], existing: ExistingGeneratedReminder[]): ReconcileResult {
  const existingByKey = new Map(existing.map((row) => [sourceKey(row.sourceType, row.sourceId), row]));
  const desiredKeys = new Set(desired.map((row) => sourceKey(row.sourceType, row.sourceId)));

  const toInsert: DesiredReminder[] = [];
  const toUpdate: ReminderUpdate[] = [];

  for (const item of desired) {
    const found = existingByKey.get(sourceKey(item.sourceType, item.sourceId));
    if (!found) {
      toInsert.push(item);
      continue;
    }

    if (found.status === "canceled") continue; // palavra final do dono

    if (found.status === "completed") {
      if (found.sendAt === item.sendAt) continue; // mesma ocorrência, já resolvida
      toUpdate.push({ id: found.id, sendAt: item.sendAt, variables: item.variables, contactIds: item.contactIds, status: "scheduled" });
      continue;
    }

    // scheduled ou paused: refresca sem mexer no status
    toUpdate.push({ id: found.id, sendAt: item.sendAt, variables: item.variables, contactIds: item.contactIds });
  }

  const toCancel = existing
    .filter((row) => !desiredKeys.has(sourceKey(row.sourceType, row.sourceId)) && (row.status === "scheduled" || row.status === "paused"))
    .map((row) => row.id);

  return { toInsert, toUpdate, toCancel };
}
