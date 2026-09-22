import { describe, expect, it } from "vitest";
import { appendChecklistItem, flattenChecklist, toggleChecklistItem } from "./checklist";

function doc(...items: { text: string; checked: boolean }[]) {
  return {
    type: "doc",
    content: [
      {
        type: "taskList",
        content: items.map((item) => ({
          type: "taskItem",
          attrs: { checked: item.checked },
          content: [{ type: "paragraph", content: item.text ? [{ type: "text", text: item.text }] : [] }],
        })),
      },
    ],
  };
}

describe("flattenChecklist", () => {
  it("achata os taskItem em ordem, com texto e estado", () => {
    const result = flattenChecklist(doc({ text: "Leite", checked: false }, { text: "Pão", checked: true }));
    expect(result).toEqual([
      { index: 0, text: "Leite", checked: false },
      { index: 1, text: "Pão", checked: true },
    ]);
  });

  it("doc nulo vira lista vazia", () => {
    expect(flattenChecklist(null)).toEqual([]);
  });

  it("achata taskItem aninhado também, na ordem do documento", () => {
    const nested = {
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Etapa 1" }] },
                { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Sub" }] }] }] },
              ],
            },
          ],
        },
      ],
    };
    expect(flattenChecklist(nested).map((i) => i.text)).toEqual(["Etapa 1", "Sub"]);
  });
});

describe("toggleChecklistItem", () => {
  it("marca só o item no índice pedido", () => {
    const before = doc({ text: "Leite", checked: false }, { text: "Pão", checked: false });
    const after = toggleChecklistItem(before, 1, true);
    expect(flattenChecklist(after)).toEqual([
      { index: 0, text: "Leite", checked: false },
      { index: 1, text: "Pão", checked: true },
    ]);
  });

  it("desmarca um item já marcado", () => {
    const before = doc({ text: "Leite", checked: true });
    const after = toggleChecklistItem(before, 0, false);
    expect(flattenChecklist(after)[0]?.checked).toBe(false);
  });
});

describe("appendChecklistItem", () => {
  it("acrescenta no fim do último taskList existente", () => {
    const before = doc({ text: "Leite", checked: false });
    const after = appendChecklistItem(before, "Ovos");
    expect(flattenChecklist(after).map((i) => i.text)).toEqual(["Leite", "Ovos"]);
  });

  it("documento sem taskList: cria um novo com o item", () => {
    const before = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Nota qualquer" }] }] };
    const after = appendChecklistItem(before, "Primeiro item");
    expect(flattenChecklist(after)).toEqual([{ index: 0, text: "Primeiro item", checked: false }]);
  });

  it("documento nulo: cria doc novo com o item", () => {
    const after = appendChecklistItem(null, "Primeiro item");
    expect(flattenChecklist(after)).toEqual([{ index: 0, text: "Primeiro item", checked: false }]);
  });

  it("item novo sempre nasce desmarcado", () => {
    const after = appendChecklistItem(null, "X");
    expect(flattenChecklist(after)[0]?.checked).toBe(false);
  });
});
