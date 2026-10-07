/**
 * "Nos seus links" (9.7): o que aconteceu nos links da dona desde a última
 * vez que ela olhou — comentários e itens marcados/desmarcados. Puro: monta
 * o texto de cada linha e junta as duas fontes em ordem de chegada.
 */
export type LinkActivityKind = "comment" | "check" | "uncheck" | "add" | "rate" | "edit" | "delete";

export interface LinkActivity {
  id: string;
  kind: LinkActivityKind;
  /** Quem comentou, ou quem mexeu num link de edição (o nome do link). Marcação num link comum é anônima. */
  author: string | null;
  /** Texto do comentário ou do item marcado. */
  text: string | null;
  itemId: string | null;
  itemTitle: string | null;
  createdAt: string;
}

function quote(text: string, max = 80): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return `“${clean.length > max ? `${clean.slice(0, max - 1)}…` : clean}”`;
}

export function linkActivityLabel(activity: LinkActivity): string {
  const where = activity.itemTitle ? ` em ${quote(activity.itemTitle, 40)}` : "";
  if (activity.kind === "comment") {
    const who = activity.author?.trim() || "Alguém";
    return `${who} comentou${where}${activity.text ? `: ${quote(activity.text)}` : ""}`;
  }
  const what = activity.text ? quote(activity.text, 60) : "um item";
  const who = activity.author?.trim();
  if (activity.kind === "add" || activity.kind === "rate" || activity.kind === "edit" || activity.kind === "delete") {
    const verbs = { add: "adicionou", rate: "deu nota em", edit: "editou", delete: "apagou" } as const;
    return `${who || "Alguém"} ${verbs[activity.kind]} ${what}${where}`;
  }
  const checked = activity.kind === "check";
  if (who) return `${who} ${checked ? "marcou" : "desmarcou"} ${what}${where}`;
  return `${checked ? "Marcaram" : "Desmarcaram"} ${what}${where}`;
}

/** Junta as fontes, mais recentes primeiro. */
export function mergeLinkActivity(...sources: LinkActivity[][]): LinkActivity[] {
  return sources.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
