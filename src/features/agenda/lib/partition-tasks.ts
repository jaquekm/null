import type { AgendaEntry } from "./agenda-entry";

export interface PartitionedTasks {
  overdue: AgendaEntry[];
  dueToday: AgendaEntry[];
}

/** Separa prazos de itens (3.6, planejador do dia) em atrasados (antes de hoje) e do dia, cada grupo em ordem crescente. */
export function partitionTasksByDueness(tasks: AgendaEntry[], todayStartIso: string): PartitionedTasks {
  const todayStart = new Date(todayStartIso).getTime();
  const sorted = [...tasks].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    overdue: sorted.filter((task) => new Date(task.start).getTime() < todayStart),
    dueToday: sorted.filter((task) => new Date(task.start).getTime() >= todayStart),
  };
}
