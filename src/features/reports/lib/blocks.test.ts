import { describe, expect, it } from "vitest";
import { budgetStatusFromPercent } from "./blocks";

describe("budgetStatusFromPercent", () => {
  it("abaixo de 80% é under", () => {
    expect(budgetStatusFromPercent(50)).toBe("under");
  });

  it("entre 80% e 100% é warning", () => {
    expect(budgetStatusFromPercent(85)).toBe("warning");
  });

  it("acima de 100% é over", () => {
    expect(budgetStatusFromPercent(120)).toBe("over");
  });
});
