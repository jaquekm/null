import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import {
  addItemToSection,
  addSection,
  chooseOnly,
  listEntries,
  listSections,
  listStyleOf,
  moveListItem,
  moveListItemToSection,
  setItemScore,
  sortByScore,
} from "./list-styles";

function item(text: string, checked = false, extra: Record<string, unknown> = {}, children?: JSONContent): JSONContent {
  return {
    type: "taskItem",
    attrs: { checked, ...extra },
    content: [{ type: "paragraph", content: [{ type: "text", text }] }, ...(children ? [children] : [])],
  };
}
const list = (...items: JSONContent[]): JSONContent => ({ type: "taskList", content: items });
const heading = (text: string): JSONContent => ({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text }] });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

const titles = (d: JSONContent) => listSections(d).map((s) => [s.title, s.entries.map((e) => e.text)]);

describe("listStyleOf", () => {
  it("lê o tipo salvo e cai em Riscar quando não tem ou é inválido", () => {
    expect(listStyleOf({ list_style: "rating" })).toBe("rating");
    expect(listStyleOf({})).toBe("checklist");
    expect(listStyleOf({ list_style: "outro" })).toBe("checklist");
    expect(listStyleOf(null)).toBe("checklist");
  });
});

describe("listEntries", () => {
  it("inclui aninhados na ordem do documento, com a nota", () => {
    const d = doc(list(item("A", false, { score: 4 }, list(item("A.1"))), item("B", true)));
    expect(listEntries(d)).toEqual([
      { index: 0, text: "A", checked: false, score: 4 },
      { index: 1, text: "A.1", checked: false, score: null },
      { index: 2, text: "B", checked: true, score: null },
    ]);
  });
});

describe("chooseOnly", () => {
  it("marca só o item tocado e desmarca os outros", () => {
    const d = doc(list(item("A", true), item("B"), item("C", true)));
    expect(listEntries(chooseOnly(d, 1)).map((e) => e.checked)).toEqual([false, true, false]);
  });

  it("tocar de novo na escolha desfaz", () => {
    const d = doc(list(item("A"), item("B", true)));
    expect(listEntries(chooseOnly(d, 1)).map((e) => e.checked)).toEqual([false, false]);
  });
});

describe("setItemScore / sortByScore", () => {
  it("grava a nota só no item e ignora valor fora de 1–5", () => {
    const d = doc(list(item("A"), item("B")));
    expect(listEntries(setItemScore(d, 1, 5)).map((e) => e.score)).toEqual([null, 5]);
    expect(listEntries(setItemScore(d, 1, 9)).map((e) => e.score)).toEqual([null, null]);
    expect(listEntries(setItemScore(setItemScore(d, 0, 3), 0, null)).map((e) => e.score)).toEqual([null, null]);
  });

  it("ordena da maior nota para a menor; sem nota vai para o fim na ordem original", () => {
    const d = doc(list(item("A"), item("B", false, { score: 2 }), item("C"), item("D", false, { score: 5 })));
    expect(sortByScore(listEntries(d)).map((e) => e.text)).toEqual(["D", "B", "A", "C"]);
  });
});

describe("listSections", () => {
  it("agrupa pelos títulos e esconde o grupo inicial vazio", () => {
    const d = doc(heading("Saúde"), list(item("Dormir"), item("Treinar")), { type: "paragraph" }, heading("Família"), list(item("Ligar pra mãe")));
    expect(titles(d)).toEqual([
      ["Saúde", ["Dormir", "Treinar"]],
      ["Família", ["Ligar pra mãe"]],
    ]);
  });

  it("sem títulos é um grupo só, sem nome", () => {
    expect(titles(doc(list(item("A"))))).toEqual([[null, ["A"]]]);
    expect(titles(doc())).toEqual([[null, []]]);
  });

  it("aninhados não viram itens do grupo, mas contam na posição", () => {
    const d = doc(list(item("A", false, {}, list(item("A.1"))), item("B")));
    expect(listSections(d)[0]?.entries.map((e) => [e.text, e.index])).toEqual([
      ["A", 0],
      ["B", 2],
    ]);
  });
});

describe("moveListItem", () => {
  const base = () => doc(heading("Saúde"), list(item("Dormir"), item("Treinar")), heading("Família"), list(item("Ligar pra mãe")));

  it("troca de posição dentro do grupo", () => {
    expect(titles(moveListItem(base(), 1, "up"))[0]).toEqual(["Saúde", ["Treinar", "Dormir"]]);
    expect(titles(moveListItem(base(), 0, "down"))[0]).toEqual(["Saúde", ["Treinar", "Dormir"]]);
  });

  it("no fim do grupo, descer leva para o começo do próximo", () => {
    expect(titles(moveListItem(base(), 1, "down"))).toEqual([
      ["Saúde", ["Dormir"]],
      ["Família", ["Treinar", "Ligar pra mãe"]],
    ]);
  });

  it("no topo do grupo, subir leva para o fim do anterior e tira a lista vazia", () => {
    const moved = moveListItem(base(), 2, "up");
    expect(titles(moved)).toEqual([
      ["Saúde", ["Dormir", "Treinar", "Ligar pra mãe"]],
      ["Família", []],
    ]);
    expect(moved.content?.filter((b) => b.type === "taskList")).toHaveLength(1);
  });

  it("entra num grupo vazio criando a lista logo depois do título", () => {
    const d = doc(heading("Saúde"), list(item("Dormir")), heading("Família"));
    const moved = moveListItem(d, 0, "down");
    expect(titles(moved)).toEqual([
      ["Saúde", []],
      ["Família", ["Dormir"]],
    ]);
    expect(moved.content?.map((b) => b.type)).toEqual(["heading", "heading", "taskList"]);
  });

  it("primeiro item não sobe e último não desce; o original não é alterado", () => {
    const d = base();
    const snapshot = structuredClone(d);
    expect(moveListItem(d, 0, "up")).toBe(d);
    expect(moveListItem(d, 2, "down")).toBe(d);
    moveListItem(d, 1, "down");
    expect(d).toEqual(snapshot);
  });

  it("leva os subitens junto", () => {
    const d = doc(list(item("A", false, {}, list(item("A.1"))), item("B")));
    expect(listEntries(moveListItem(d, 0, "down")).map((e) => e.text)).toEqual(["B", "A", "A.1"]);
  });
});

describe("moveListItemToSection / addItemToSection / addSection", () => {
  it("manda o item para o fim de outro grupo", () => {
    const d = doc(heading("Saúde"), list(item("Dormir"), item("Treinar")), heading("Família"), list(item("Ligar pra mãe")));
    expect(titles(moveListItemToSection(d, 0, 1))).toEqual([
      ["Saúde", ["Treinar"]],
      ["Família", ["Ligar pra mãe", "Dormir"]],
    ]);
  });

  it("usa o índice do grupo como aparece na tela (grupo inicial vazio escondido)", () => {
    const d = doc(heading("Saúde"), list(item("Dormir")), heading("Família"));
    expect(titles(addItemToSection(d, 1, "Ligar pra mãe"))).toEqual([
      ["Saúde", ["Dormir"]],
      ["Família", ["Ligar pra mãe"]],
    ]);
  });

  it("cria o primeiro item de uma lista vazia", () => {
    expect(titles(addItemToSection(null, 0, "Primeiro"))).toEqual([[null, ["Primeiro"]]]);
  });

  it("novo grupo aparece no fim, vazio", () => {
    const d = addSection(doc(list(item("A"))), "Trabalho");
    expect(titles(d)).toEqual([
      [null, ["A"]],
      ["Trabalho", []],
    ]);
  });
});
