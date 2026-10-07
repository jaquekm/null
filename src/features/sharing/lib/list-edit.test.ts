import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { listEntries } from "@/features/items/lib/list-styles";
import { applyListEdit, type ListEditOp } from "./list-edit";

const ana = { linkId: "link-ana", name: "Ana" };
const bia = { linkId: "link-bia", name: "Bia" };

const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const item = (text: string, attrs: Record<string, unknown> = {}): JSONContent => ({ type: "taskItem", attrs: { checked: false, ...attrs }, content: [p(text)] });
const doc = (...items: JSONContent[]): JSONContent => ({ type: "doc", content: [{ type: "taskList", content: items }] });

function run(content: JSONContent | null, style: Parameters<typeof applyListEdit>[1], editor: typeof ana, op: ListEditOp) {
  return applyListEdit(content, style, editor, op);
}

describe("applyListEdit — edição de lista por link", () => {
  it("adicionar: o item nasce com o autor e o link", () => {
    const result = run(doc(item("Boliche")), "rating", ana, { op: "add", text: "Kart" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe("add");
    expect(listEntries(result.content).map((e) => [e.text, e.author, e.authorLink])).toEqual([
      ["Boliche", null, null],
      ["Kart", "Ana", "link-ana"],
    ]);
  });

  it("adicionar em lista vazia (sem documento) funciona", () => {
    const result = run(null, "checklist", ana, { op: "add", text: "Leite" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(listEntries(result.content).map((e) => e.text)).toEqual(["Leite"]);
  });

  it("nota: grava a nota e quem deu; só no tipo 'Dar nota'", () => {
    const result = run(doc(item("Boliche")), "rating", ana, { op: "rate", index: 0, expectText: "Boliche", score: 4 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(listEntries(result.content)[0]).toMatchObject({ score: 4, scoreBy: "Ana" });
    expect(run(doc(item("Boliche")), "checklist", ana, { op: "rate", index: 0, expectText: "Boliche", score: 4 }).ok).toBe(false);
  });

  it("a nota de outra pessoa é substituída, e apagar a nota apaga o nome", () => {
    const rated = doc(item("Boliche", { score: 5, scoreBy: "Bia" }));
    const replaced = run(rated, "rating", ana, { op: "rate", index: 0, expectText: "Boliche", score: 3 });
    if (!replaced.ok) throw new Error("falhou");
    expect(listEntries(replaced.content)[0]).toMatchObject({ score: 3, scoreBy: "Ana" });
    const cleared = run(replaced.content, "rating", ana, { op: "rate", index: 0, expectText: "Boliche", score: null });
    if (!cleared.ok) throw new Error("falhou");
    expect(listEntries(cleared.content)[0]).toMatchObject({ score: null, scoreBy: null });
  });

  it("editar e apagar: só o que a própria pessoa adicionou", () => {
    const content = doc(item("Da dona"), item("Da Ana", { author: "Ana", authorLink: "link-ana" }), item("Da Bia", { author: "Bia", authorLink: "link-bia" }));
    const edit = (index: number, expectText: string, editor = ana) => run(content, "checklist", editor, { op: "edit", index, expectText, text: "Novo", details: "" });
    expect(edit(0, "Da dona").ok).toBe(false); // da dona
    expect(edit(2, "Da Bia").ok).toBe(false); // de outra pessoa
    expect(edit(1, "Da Ana").ok).toBe(true);
    expect(run(content, "checklist", ana, { op: "remove", index: 0, expectText: "Da dona" }).ok).toBe(false);
    expect(run(content, "checklist", ana, { op: "remove", index: 2, expectText: "Da Bia" }).ok).toBe(false);
    const removed = run(content, "checklist", ana, { op: "remove", index: 1, expectText: "Da Ana" });
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(listEntries(removed.content).map((e) => e.text)).toEqual(["Da dona", "Da Bia"]);
    // Outra pessoa com outro link não apaga o item da Ana, mesmo com o mesmo nome.
    expect(edit(1, "Da Ana", { linkId: "outro-link", name: "Ana" }).ok).toBe(false);
  });

  it("editar troca nome e detalhes e mantém o autor e a nota", () => {
    const content = doc(item("Kart", { author: "Ana", authorLink: "link-ana", score: 4, scoreBy: "Bia" }));
    const result = run(content, "rating", ana, { op: "edit", index: 0, expectText: "Kart", text: "Kart Floripa", details: "https://kart.com\nR$ 90" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(listEntries(result.content)[0]).toMatchObject({ text: "Kart Floripa", details: "https://kart.com\nR$ 90", author: "Ana", score: 4, scoreBy: "Bia" });
  });

  it("lista que mudou no meio-tempo (posição já é de outro item) não altera nada", () => {
    const content = doc(item("Kart"), item("Boliche"));
    const result = run(content, "rating", ana, { op: "rate", index: 0, expectText: "Boliche", score: 5 });
    expect(result).toEqual({ ok: false, error: expect.stringContaining("A lista mudou") });
  });

  it("marcar: escolher um desmarca os outros; riscar alterna; nota e prioridade não têm marcação", () => {
    const single = run(doc(item("A", { checked: true }), item("B")), "single", ana, { op: "toggle", index: 1, expectText: "B" });
    if (!single.ok) throw new Error("falhou");
    expect(listEntries(single.content).map((e) => e.checked)).toEqual([false, true]);
    expect(single.kind).toBe("check");
    const multi = run(doc(item("A", { checked: true })), "multi", ana, { op: "toggle", index: 0, expectText: "A" });
    if (!multi.ok) throw new Error("falhou");
    expect(multi.kind).toBe("uncheck");
    expect(run(doc(item("A")), "rating", ana, { op: "toggle", index: 0, expectText: "A" }).ok).toBe(false);
    expect(run(doc(item("A")), "priority", ana, { op: "toggle", index: 0, expectText: "A" }).ok).toBe(false);
  });

  it("o bia também adiciona, e cada um fica com o seu", () => {
    const first = run(doc(), "checklist", ana, { op: "add", text: "Pão" });
    if (!first.ok) throw new Error("falhou");
    const second = run(first.content, "checklist", bia, { op: "add", text: "Leite" });
    if (!second.ok) throw new Error("falhou");
    expect(listEntries(second.content).map((e) => [e.text, e.author])).toEqual([["Pão", "Ana"], ["Leite", "Bia"]]);
  });
});
