import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("aceita um caminho relativo", () => {
    expect(safeNext("/agenda")).toBe("/agenda");
  });

  it("usa o fallback quando next está ausente", () => {
    expect(safeNext(undefined)).toBe("/hoje");
    expect(safeNext(null)).toBe("/hoje");
    expect(safeNext("")).toBe("/hoje");
  });

  it("rejeita URLs absolutas e protocol-relative (open redirect)", () => {
    expect(safeNext("https://evil.example.com")).toBe("/hoje");
    expect(safeNext("//evil.example.com")).toBe("/hoje");
    expect(safeNext("javascript:alert(1)")).toBe("/hoje");
  });

  it("aceita um fallback customizado", () => {
    expect(safeNext(undefined, "/login/mfa")).toBe("/login/mfa");
  });
});
