import { describe, expect, it } from "vitest";
import { resetChecklist } from "./reset-checklist";

describe("resetChecklist", () => {
  it("desmarca todos os taskItem, mantendo o texto", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Leite" }] }] },
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Pão" }] }] },
          ],
        },
      ],
    };

    const result = resetChecklist(doc);
    const items = result?.content?.[0]?.content ?? [];
    expect(items.map((item) => item.attrs?.checked)).toEqual([false, false]);
    expect(items[0]?.content?.[0]?.content?.[0]?.text).toBe("Leite");
  });

  it("desmarca taskItem aninhado (sub-lista)", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Etapa 1" }] },
                { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Sub-etapa" }] }] }] },
              ],
            },
          ],
        },
      ],
    };

    const result = resetChecklist(doc);
    const outer = result?.content?.[0]?.content?.[0];
    const inner = outer?.content?.[1]?.content?.[0];
    expect(outer?.attrs?.checked).toBe(false);
    expect(inner?.attrs?.checked).toBe(false);
  });

  it("conteúdo sem taskItem passa intacto", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Nada aqui" }] }] };
    expect(resetChecklist(doc)).toEqual(doc);
  });

  it("null passa intacto", () => {
    expect(resetChecklist(null)).toBeNull();
  });
});
