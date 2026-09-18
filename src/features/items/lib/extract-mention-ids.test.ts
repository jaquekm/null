import { describe, expect, it } from "vitest";
import { extractMentionIds } from "./extract-mention-ids";

describe("extractMentionIds", () => {
  it("retorna array vazio para doc nulo", () => {
    expect(extractMentionIds(null)).toEqual([]);
  });

  it("retorna array vazio quando não há menções", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "sem links" }] }] };
    expect(extractMentionIds(doc)).toEqual([]);
  });

  it("coleta os ids dos nós mention", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Ver " },
            { type: "mention", attrs: { id: "item-1", label: "Item 1" } },
            { type: "text", text: " e " },
            { type: "mention", attrs: { id: "item-2", label: "Item 2" } },
          ],
        },
      ],
    };
    expect(extractMentionIds(doc)).toEqual(["item-1", "item-2"]);
  });

  it("retorna ids únicos quando o mesmo item é mencionado mais de uma vez", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { id: "item-1" } },
            { type: "mention", attrs: { id: "item-1" } },
          ],
        },
      ],
    };
    expect(extractMentionIds(doc)).toEqual(["item-1"]);
  });

  it("ignora mention sem id", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "mention", attrs: {} }] }] };
    expect(extractMentionIds(doc)).toEqual([]);
  });
});
