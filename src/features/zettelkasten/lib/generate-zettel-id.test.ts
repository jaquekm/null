import { describe, expect, it } from "vitest";
import { generateZettelId } from "./generate-zettel-id";

describe("generateZettelId", () => {
  it("gera AAAAMMDDHHmmss com zero à esquerda", () => {
    expect(generateZettelId(new Date(2026, 8, 22, 9, 5, 3))).toBe("20260922090503");
  });

  it("datas diferentes por um segundo geram ids diferentes e crescentes", () => {
    const a = generateZettelId(new Date(2026, 8, 22, 9, 5, 3));
    const b = generateZettelId(new Date(2026, 8, 22, 9, 5, 4));
    expect(a < b).toBe(true);
  });
});
