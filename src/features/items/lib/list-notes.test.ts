import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { hasConvertibleLines, listNoteLines, noteLinesToListItems } from "./list-notes";
import { listEntries, listSections } from "./list-styles";

const p = (...parts: (string | "BR")[]): JSONContent => ({
  type: "paragraph",
  content: parts.map((part) => (part === "BR" ? { type: "hardBreak" } : { type: "text", text: part })),
});
const h = (text: string): JSONContent => ({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text }] });
const bullets = (...texts: string[]): JSONContent => ({
  type: "bulletList",
  content: texts.map((text) => ({ type: "listItem", content: [p(text)] })),
});
const tasks = (...texts: string[]): JSONContent => ({
  type: "taskList",
  content: texts.map((text) => ({ type: "taskItem", attrs: { checked: false }, content: [p(text)] })),
});
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

describe("listNoteLines", () => {
  it("mostra o texto fora da lista (antes sumia no modo lista)", () => {
    const d = doc(p("Salário PJ de setembro"), p("Nota fiscal", "BR", "Imposto 6%"), bullets("Cliente A", "Cliente B"), tasks("Emitir nota"));
    expect(listNoteLines(d, "rating")).toEqual([
      { kind: "text", text: "Salário PJ de setembro" },
      { kind: "text", text: "Nota fiscal" },
      { kind: "text", text: "Imposto 6%" },
      { kind: "bullet", text: "Cliente A" },
      { kind: "bullet", text: "Cliente B" },
    ]);
  });

  it("título é texto nos tipos comuns, mas grupo no 'Ordenar e agrupar'", () => {
    const d = doc(h("Saúde"), tasks("Academia"));
    expect(listNoteLines(d, "checklist")).toEqual([{ kind: "heading", text: "Saúde" }]);
    expect(listNoteLines(d, "priority")).toEqual([]);
  });

  it("parágrafo vazio e documento vazio não geram linha", () => {
    expect(listNoteLines(doc(p(""), tasks("x")), "checklist")).toEqual([]);
    expect(listNoteLines(null, "checklist")).toEqual([]);
  });
});

describe("noteLinesToListItems", () => {
  it("cada linha e cada tópico viram item com caixinha, numa lista só", () => {
    const d = doc(p("Pão", "BR", "Leite"), bullets("Ovos"));
    const next = noteLinesToListItems(d);
    expect(listEntries(next).map((e) => [e.text, e.checked])).toEqual([
      ["Pão", false],
      ["Leite", false],
      ["Ovos", false],
    ]);
    expect(next.content).toHaveLength(1);
    expect(listNoteLines(next, "checklist")).toEqual([]);
  });

  it("junta com a lista que já existe logo em seguida, mantendo o que já estava marcado", () => {
    const checked: JSONContent = { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [p("Feito")] }] };
    const next = noteLinesToListItems(doc(checked, p("Novo")));
    expect(listEntries(next).map((e) => [e.text, e.checked])).toEqual([
      ["Feito", true],
      ["Novo", false],
    ]);
  });

  it("mantém os grupos do 'Ordenar e agrupar' no lugar", () => {
    const next = noteLinesToListItems(doc(h("Saúde"), p("Academia"), h("Trabalho"), p("Relatório")));
    expect(listSections(next).map((s) => [s.title, s.entries.map((e) => e.text)])).toEqual([
      ["Saúde", ["Academia"]],
      ["Trabalho", ["Relatório"]],
    ]);
  });

  it("não mexe em bloco que não é texto simples", () => {
    const image: JSONContent = { type: "image", attrs: { src: "x" } };
    const next = noteLinesToListItems(doc(image, p("A")));
    expect(next.content?.[0]).toEqual(image);
  });
});

describe("hasConvertibleLines", () => {
  it("só quando há texto que não é título", () => {
    expect(hasConvertibleLines(doc(p("a")), "checklist")).toBe(true);
    expect(hasConvertibleLines(doc(h("Grupo"), tasks("x")), "checklist")).toBe(false);
    expect(hasConvertibleLines(doc(tasks("x")), "checklist")).toBe(false);
  });
});
