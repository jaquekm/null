import { describe, expect, it } from "vitest";
import { resolveCoverSrc } from "./resolve-cover";

describe("resolveCoverSrc", () => {
  it("prefere cover_path quando presente", () => {
    expect(resolveCoverSrc("/api/attachments/1/file", { type: "doc", content: [] })).toBe("/api/attachments/1/file");
  });

  it("sem cover_path, usa a primeira imagem do conteúdo", () => {
    const content = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "oi" }] },
        { type: "image", attrs: { src: "/api/attachments/2/file" } },
      ],
    };
    expect(resolveCoverSrc(null, content)).toBe("/api/attachments/2/file");
  });

  it("procura a imagem em qualquer profundidade (dentro de listas, etc.)", () => {
    const content = {
      type: "doc",
      content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "image", attrs: { src: "/deep.png" } }] }] }],
    };
    expect(resolveCoverSrc(null, content)).toBe("/deep.png");
  });

  it("sem cover_path e sem imagem no conteúdo: null", () => {
    expect(resolveCoverSrc(null, { type: "doc", content: [{ type: "paragraph", content: [] }] })).toBeNull();
  });

  it("sem cover_path e sem conteúdo: null", () => {
    expect(resolveCoverSrc(null, null)).toBeNull();
  });
});
