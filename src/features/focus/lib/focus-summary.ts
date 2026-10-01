export interface FocusSessionForSummary {
  itemId: string | null;
  itemTitle: string | null;
  durationMinutes: number | null;
}

export interface FocusSummaryByItem {
  itemId: string | null;
  itemTitle: string;
  minutes: number;
}

export interface FocusSummary {
  totalMinutes: number;
  byItem: FocusSummaryByItem[];
}

const NO_ITEM_KEY = "__sem_tarefa__";

/** "Onde foi meu tempo" (10.3) — agrupa sessões de foco por item, do que mais teve tempo pro que menos teve. Sessão sem item (não devia acontecer na prática, já que o cronômetro só existe na página de uma tarefa/projeto) entra à parte, como "Sem tarefa". */
export function summarizeFocusSessions(sessions: FocusSessionForSummary[]): FocusSummary {
  const byKey = new Map<string, FocusSummaryByItem>();
  let totalMinutes = 0;

  for (const session of sessions) {
    const minutes = session.durationMinutes ?? 0;
    totalMinutes += minutes;

    const key = session.itemId ?? NO_ITEM_KEY;
    const existing = byKey.get(key);
    if (existing) {
      existing.minutes += minutes;
      continue;
    }
    const itemTitle = session.itemId === null ? "Sem tarefa" : session.itemTitle || "Sem título";
    byKey.set(key, { itemId: session.itemId, itemTitle, minutes });
  }

  return { totalMinutes, byItem: [...byKey.values()].sort((a, b) => b.minutes - a.minutes) };
}

/** "2h 15min" / "45min" / "0min" — usado no resumo semanal e no cronômetro. */
export function formatFocusDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}min`;
}
