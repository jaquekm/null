import type { JSONContent } from "@tiptap/core";
import { z } from "zod";
import { toggleChecklistItem } from "@/features/items/lib/checklist";
import {
  addItemToSection,
  chooseOnly,
  listEntries,
  listSections,
  removeListItem,
  setItemDetails,
  setItemScore,
  setItemText,
  type ListStyle,
} from "@/features/items/lib/list-styles";

/**
 * Edição de lista por link (07/10, permissão `edit`): quem recebe o link —
 * um link por pessoa, com o nome em `share_links.label` — pode adicionar
 * itens, dar nota, marcar e editar/apagar **só o que ele mesmo adicionou**. O
 * autor de cada item e de cada nota fica no próprio documento (atributos do
 * `taskItem`), então a dona vê "por Fulano" sem tabela nova.
 */

export const MAX_ITEM_TEXT = 300;
export const MAX_ITEM_DETAILS = 2000;

/** `expectText` é o nome do item como a pessoa viu: se a lista mudou no meio-tempo, a posição já não é a mesma e nada é alterado. */
export const listEditOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), text: z.string().trim().min(1, "Escreva o nome do item.").max(MAX_ITEM_TEXT) }),
  z.object({ op: z.literal("rate"), index: z.number().int().min(0), expectText: z.string(), score: z.number().int().min(1).max(5).nullable() }),
  z.object({ op: z.literal("toggle"), index: z.number().int().min(0), expectText: z.string() }),
  z.object({
    op: z.literal("edit"),
    index: z.number().int().min(0),
    expectText: z.string(),
    text: z.string().trim().min(1, "O item precisa de um nome.").max(MAX_ITEM_TEXT),
    details: z.string().max(MAX_ITEM_DETAILS),
  }),
  z.object({ op: z.literal("remove"), index: z.number().int().min(0), expectText: z.string() }),
]);

export type ListEditOp = z.infer<typeof listEditOpSchema>;

export interface ListEditor {
  /** Id do link (dono do que foi adicionado). */
  linkId: string;
  /** Nome de quem usa o link. */
  name: string;
}

export type ListEditResult =
  | { ok: true; content: JSONContent; kind: "add" | "rate" | "edit" | "delete" | "check" | "uncheck"; detail: string }
  | { ok: false; error: string };

const STALE = "A lista mudou enquanto você olhava. Atualizei — tente de novo.";

function same(a: string, b: string): boolean {
  return a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
}

export function applyListEdit(content: JSONContent | null, style: ListStyle, editor: ListEditor, op: ListEditOp): ListEditResult {
  const doc: JSONContent = content ?? { type: "doc", content: [] };

  if (op.op === "add") {
    const sections = listSections(doc);
    const last = Math.max(0, sections.length - 1);
    return { ok: true, content: addItemToSection(doc, last, op.text, { name: editor.name, link: editor.linkId }), kind: "add", detail: op.text };
  }

  const entry = listEntries(doc)[op.index];
  if (!entry || !same(entry.text, op.expectText)) return { ok: false, error: STALE };

  if (op.op === "rate") {
    if (style !== "rating") return { ok: false, error: "Essa lista não tem notas." };
    return { ok: true, content: setItemScore(doc, op.index, op.score, editor.name), kind: "rate", detail: entry.text };
  }

  if (op.op === "toggle") {
    if (style === "rating" || style === "priority") return { ok: false, error: "Esse tipo de lista não tem marcação." };
    const next = style === "single" ? chooseOnly(doc, op.index) : toggleChecklistItem(doc, op.index, !entry.checked);
    const nowChecked = listEntries(next)[op.index]?.checked === true;
    return { ok: true, content: next, kind: nowChecked ? "check" : "uncheck", detail: entry.text };
  }

  // Editar e apagar: só o que a própria pessoa adicionou por esse link.
  if (entry.authorLink !== editor.linkId) return { ok: false, error: "Você só pode editar ou apagar o que você mesmo adicionou." };

  if (op.op === "edit") {
    const renamed = setItemText(doc, op.index, op.text);
    return { ok: true, content: setItemDetails(renamed, op.index, op.details), kind: "edit", detail: op.text };
  }

  return { ok: true, content: removeListItem(doc, op.index), kind: "delete", detail: entry.text };
}
