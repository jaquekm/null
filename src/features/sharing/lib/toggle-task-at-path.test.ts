import { describe, expect, it } from "vitest";
import { injectTaskItemPaths, toggleTaskAtPath, type JSONContentNode } from "./toggle-task-at-path";

function checklist(): JSONContentNode {
  return {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Lista de compras" }] },
      {
        type: "taskList",
        content: [
          { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Leite" }] }] },
          { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Pão" }] }] },
        ],
      },
    ],
  };
}

describe("injectTaskItemPaths", () => {
  it("marca cada taskItem com o caminho até ele", () => {
    const tagged = injectTaskItemPaths(checklist());
    const taskList = tagged.content![1]!;
    expect(taskList.content![0]!.attrs?.path).toBe("1.0");
    expect(taskList.content![1]!.attrs?.path).toBe("1.1");
  });

  it("não mexe em nós que não são taskItem", () => {
    const tagged = injectTaskItemPaths(checklist());
    expect(tagged.content![0]!.attrs).toBeUndefined();
  });

  it("preserva os outros attrs do taskItem (checked)", () => {
    const tagged = injectTaskItemPaths(checklist());
    const taskList = tagged.content![1]!;
    expect(taskList.content![0]!.attrs?.checked).toBe(false);
    expect(taskList.content![1]!.attrs?.checked).toBe(true);
  });

  it("checklist aninhada (taskItem dentro de taskItem) recebe caminhos com mais de um nível", () => {
    const nested: JSONContentNode = {
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Pai" }] },
                { type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [] }] },
              ],
            },
          ],
        },
      ],
    };
    const tagged = injectTaskItemPaths(nested);
    const parent = tagged.content![0]!.content![0]!;
    const child = parent.content![1]!.content![0]!;
    expect(parent.attrs?.path).toBe("0.0");
    expect(child.attrs?.path).toBe("0.0.1.0");
  });
});

describe("toggleTaskAtPath", () => {
  it("marca o taskItem no caminho certo, sem mexer nos outros", () => {
    const result = toggleTaskAtPath(checklist(), "1.0", true);
    expect(result!.content![1]!.content![0]!.attrs?.checked).toBe(true);
    expect(result!.content![1]!.content![1]!.attrs?.checked).toBe(true); // já estava true, não muda
  });

  it("desmarca", () => {
    const result = toggleTaskAtPath(checklist(), "1.1", false);
    expect(result!.content![1]!.content![1]!.attrs?.checked).toBe(false);
  });

  it("não altera o resto da árvore (imutável, mesma referência onde nada mudou)", () => {
    const original = checklist();
    const result = toggleTaskAtPath(original, "1.0", true);
    expect(result!.content![0]).toBe(original.content![0]); // parágrafo "Lista de compras" intocado
  });

  it("caminho apontando pra um nó que não é taskItem: null", () => {
    expect(toggleTaskAtPath(checklist(), "0", true)).toBeNull(); // "0" é o parágrafo, não um taskItem
  });

  it("caminho fora do intervalo: null", () => {
    expect(toggleTaskAtPath(checklist(), "1.9", true)).toBeNull();
  });

  it("caminho em formato inválido: null, não lança", () => {
    expect(toggleTaskAtPath(checklist(), "não-é-um-caminho", true)).toBeNull();
    expect(toggleTaskAtPath(checklist(), "1.-1", true)).toBeNull();
  });
});
