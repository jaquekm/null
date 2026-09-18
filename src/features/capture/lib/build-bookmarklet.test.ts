import { describe, expect, it } from "vitest";
import { buildBookmarklet } from "./build-bookmarklet";

describe("buildBookmarklet", () => {
  it("começa com o esquema javascript:", () => {
    expect(buildBookmarklet("https://hub.example.com")).toMatch(/^javascript:/);
  });

  it("embute a URL do app na chamada window.open", () => {
    const code = buildBookmarklet("https://hub.example.com");
    expect(code).toContain("https://hub.example.com/capturar?title=");
  });

  it("gera um script com sintaxe válida", () => {
    const code = buildBookmarklet("https://hub.example.com");
    const script = code.slice("javascript:".length);
    expect(() => new Function(script)).not.toThrow();
  });
});
