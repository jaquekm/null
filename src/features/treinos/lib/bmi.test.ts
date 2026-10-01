import { describe, expect, it } from "vitest";
import { bmiCategory, bmiSeries, calculateBmi } from "./bmi";

describe("calculateBmi", () => {
  it("calcula e arredonda em 1 casa", () => expect(calculateBmi(70, 175)).toBe(22.9));
  it("pessoa baixa e leve", () => expect(calculateBmi(45, 150)).toBe(20));
});

describe("bmiCategory", () => {
  it("abaixo do peso", () => expect(bmiCategory(17)).toBe("abaixo do peso"));
  it("peso normal, incluindo o limite 18.5", () => {
    expect(bmiCategory(18.5)).toBe("peso normal");
    expect(bmiCategory(24.9)).toBe("peso normal");
  });
  it("sobrepeso a partir de 25", () => {
    expect(bmiCategory(25)).toBe("sobrepeso");
    expect(bmiCategory(29.9)).toBe("sobrepeso");
  });
  it("obesidade a partir de 30", () => expect(bmiCategory(30)).toBe("obesidade"));
});

describe("bmiSeries", () => {
  const weekly = [
    { weekStart: "2026-09-07", weightKg: 70 },
    { weekStart: "2026-09-14", weightKg: null },
    { weekStart: "2026-09-21", weightKg: 69 },
  ];

  it("sem altura, tudo null", () => {
    expect(bmiSeries(weekly, null)).toEqual([
      { weekStart: "2026-09-07", bmi: null },
      { weekStart: "2026-09-14", bmi: null },
      { weekStart: "2026-09-21", bmi: null },
    ]);
  });

  it("com altura, calcula onde tem peso e deixa null onde não tem", () => {
    const series = bmiSeries(weekly, 175);
    expect(series[0]).toEqual({ weekStart: "2026-09-07", bmi: 22.9 });
    expect(series[1]).toEqual({ weekStart: "2026-09-14", bmi: null });
    expect(series[2]!.bmi).toBeCloseTo(22.5, 1);
  });
});
