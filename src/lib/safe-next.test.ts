import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("aceita um caminho relativo", () => {
    expect(safeNext("/agenda")).toBe("/agenda");
  });

  it("usa o fallback quando next está ausente", () => {
    expect(safeNext(undefined)).toBe("/inbox");
    expect(safeNext(null)).toBe("/inbox");
    expect(safeNext("")).toBe("/inbox");
  });

  it("rejeita URLs absolutas e protocol-relative (open redirect)", () => {
    expect(safeNext("https://evil.example.com")).toBe("/inbox");
    expect(safeNext("//evil.example.com")).toBe("/inbox");
    expect(safeNext("javascript:alert(1)")).toBe("/inbox");
  });

  it("aceita um fallback customizado", () => {
    expect(safeNext(undefined, "/login/mfa")).toBe("/login/mfa");
  });
});
