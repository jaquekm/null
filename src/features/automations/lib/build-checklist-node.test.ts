import { describe, expect, it } from "vitest";
import { appendChecklistToContent, buildChecklistNode } from "./build-checklist-node";

describe("buildChecklistNode", () => {
  it("um taskItem desmarcado por item", () => {
    const node = buildChecklistNode(["Ligar pro cliente", "Enviar proposta"]);
    expect(node).toEqual({
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Ligar pro cliente" }] }] },
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Enviar proposta" }] }] },
      ],
    });
  });
});

describe("appendChecklistToContent", () => {
  it("conteúdo nulo vira um doc novo só com o checklist", () => {
    const result = appendChecklistToContent(null, ["Tarefa"]);
    expect(result.type).toBe("doc");
    expect(result.content).toHaveLength(1);
    expect(result.content![0]!.type).toBe("taskList");
  });

  it("conteúdo existente: checklist vai pro final, preservando o resto", () => {
    const existing = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Nota" }] }] };
    const result = appendChecklistToContent(existing, ["Tarefa"]);
    expect(result.content).toHaveLength(2);
    expect(result.content![0]).toEqual(existing.content[0]);
    expect(result.content![1]!.type).toBe("taskList");
  });
});
