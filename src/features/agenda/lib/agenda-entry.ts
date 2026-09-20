export type AgendaSourceKind = "google-event" | "item-date" | "reminder";

/** Cor por fonte (3.6) — eventos do Google usam a cor do próprio calendário; as outras duas fontes têm uma cor fixa, só pra diferenciar visualmente. */
export const ITEM_DATE_COLOR = "#d97706";
export const REMINDER_COLOR = "#7c3aed";
export const DEFAULT_EVENT_COLOR = "#2563eb";

export interface AgendaEntry {
  id: string;
  title: string;
  /** ISO. */
  start: string;
  /** ISO, ou `null` pra um evento pontual (lembrete, prazo com hora). */
  end: string | null;
  allDay: boolean;
  color: string;
  /** Só eventos do Google podem ser arrastados/redimensionados (3.5 já sincroniza a mudança). */
  editable: boolean;
  kind: AgendaSourceKind;
  /** Pra onde um clique leva quando o item não é editável direto no calendário. */
  href: string | null;
}
