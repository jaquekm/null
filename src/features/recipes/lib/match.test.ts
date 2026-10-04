import { describe, expect, it } from "vitest";
import { findRecipeForDish, normalizeDishName, weekCoverage } from "./match";

const recipes = [
  { title: "Frango com arroz", ingredients: [{ name: "frango", qty: 300, unit: "g" }] },
  { title: "Omelete", ingredients: [] },
];

describe("findRecipeForDish", () => {
  it("ignora maiúsculas, acentos e espaços a mais", () => {
    expect(normalizeDishName("  Frângo   COM arroz ")).toBe("frango com arroz");
    expect(findRecipeForDish(recipes, "frango  com Arroz")?.title).toBe("Frango com arroz");
    expect(findRecipeForDish(recipes, "Lasanha")).toBeNull();
    expect(findRecipeForDish(recipes, "   ")).toBeNull();
  });
});

describe("weekCoverage", () => {
  it("conta pratos diferentes e diz quais ainda não têm ingrediente", () => {
    const plan = {
      MO: { almoco: "Frango com arroz", jantar: "Omelete" },
      TU: { almoco: "frango com arroz", jantar: "Sopa de legumes", cafe: "" },
    };
    expect(weekCoverage(plan, recipes)).toEqual({ dishes: 3, withIngredients: 1, missing: ["Omelete", "Sopa de legumes"] });
  });

  it("semana vazia", () => expect(weekCoverage({}, recipes)).toEqual({ dishes: 0, withIngredients: 0, missing: [] }));
});
