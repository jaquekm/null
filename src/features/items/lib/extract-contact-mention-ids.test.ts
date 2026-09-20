import { describe, expect, it } from "vitest";
import { extractContactMentionIds } from "./extract-contact-mention-ids";

describe("extractContactMentionIds", () => {
  it("devolve [] pra doc nulo", () => {
    expect(extractContactMentionIds(null)).toEqual([]);
  });

  it("encontra ids de contactMention em qualquer profundidade", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Falei com " },
            { type: "contactMention", attrs: { id: "c1", label: "João" } },
          ],
        },
      ],
    };
    expect(extractContactMentionIds(doc)).toEqual(["c1"]);
  });

  it("não confunde com mention de item (tipos diferentes)", () => {
    const doc = {
      type: "doc",
      content: [{ type: "mention", attrs: { id: "item-1" } }, { type: "contactMention", attrs: { id: "c1" } }],
    };
    expect(extractContactMentionIds(doc)).toEqual(["c1"]);
  });

  it("deduplica ids repetidos", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "contactMention", attrs: { id: "c1" } },
        { type: "paragraph", content: [{ type: "contactMention", attrs: { id: "c1" } }] },
      ],
    };
    expect(extractContactMentionIds(doc)).toEqual(["c1"]);
  });
});
