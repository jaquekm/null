import { describe, expect, it } from "vitest";
import { COLOR_TOKENS, colorBadgeClassName, colorDotClassName, colorLabel, isColorToken } from "./color-tokens";

describe("isColorToken", () => {
  it("reconhece os tokens válidos", () => {
    for (const token of COLOR_TOKENS) {
      expect(isColorToken(token)).toBe(true);
    }
  });

  it("rejeita valores fora da paleta, nulos e vazios", () => {
    expect(isColorToken("magenta")).toBe(false);
    expect(isColorToken(null)).toBe(false);
    expect(isColorToken(undefined)).toBe(false);
    expect(isColorToken("")).toBe(false);
  });
});

describe("colorDotClassName / colorBadgeClassName", () => {
  it("retorna uma classe diferente por token, todas com bg-", () => {
    const dotClasses = COLOR_TOKENS.map((token) => colorDotClassName(token));
    const badgeClasses = COLOR_TOKENS.map((token) => colorBadgeClassName(token));

    expect(new Set(dotClasses).size).toBe(COLOR_TOKENS.length);
    expect(new Set(badgeClasses).size).toBe(COLOR_TOKENS.length);
    for (const className of [...dotClasses, ...badgeClasses]) {
      expect(className).toContain("bg-");
    }
  });

  it("cai no fallback neutro para valor desconhecido", () => {
    expect(colorDotClassName("nao-existe")).toContain("zinc");
    expect(colorBadgeClassName(null)).not.toContain("undefined");
  });
});

describe("colorLabel", () => {
  it("dá um nome em português a cada token e 'Sem cor' pro resto", () => {
    expect(colorLabel("emerald")).toBe("Verde");
    expect(colorLabel("nao-existe")).toBe("Sem cor");
  });
});
