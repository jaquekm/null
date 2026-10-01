import { describe, expect, it } from "vitest";
import { formatIngredientsText, parseIngredientsText, scaleIngredients, sumIngredients } from "./ingredients";

describe("parseIngredientsText", () => {
  it("lê uma linha por ingrediente", () => {
    expect(parseIngredientsText("200 g arroz\n2 unid ovo")).toEqual([
      { qty: 200, unit: "g", name: "arroz" },
      { qty: 2, unit: "unid", name: "ovo" },
    ]);
  });

  it("vírgula decimal", () => expect(parseIngredientsText("1,5 kg batata")).toEqual([{ qty: 1.5, unit: "kg", name: "batata" }]));

  it("ignora linhas vazias e linhas que não casam o padrão", () => {
    expect(parseIngredientsText("200 g arroz\n\nsal a gosto\n")).toEqual([{ qty: 200, unit: "g", name: "arroz" }]);
  });

  it("texto vazio devolve lista vazia", () => expect(parseIngredientsText("")).toEqual([]));
});

describe("formatIngredientsText", () => {
  it("volta pro formato de texto", () => expect(formatIngredientsText([{ qty: 200, unit: "g", name: "arroz" }])).toBe("200 g arroz"));
  it("decimal com vírgula", () => expect(formatIngredientsText([{ qty: 1.5, unit: "kg", name: "batata" }])).toBe("1,5 kg batata"));
});

describe("scaleIngredients", () => {
  it("escala proporcionalmente", () => {
    expect(scaleIngredients([{ qty: 200, unit: "g", name: "arroz" }], 2, 4)).toEqual([{ qty: 400, unit: "g", name: "arroz" }]);
  });

  it("reduz também", () => {
    expect(scaleIngredients([{ qty: 200, unit: "g", name: "arroz" }], 4, 1)).toEqual([{ qty: 50, unit: "g", name: "arroz" }]);
  });

  it("porções de origem inválidas devolve a lista sem mudar", () => {
    const ingredients = [{ qty: 200, unit: "g", name: "arroz" }];
    expect(scaleIngredients(ingredients, 0, 4)).toBe(ingredients);
  });
});

describe("sumIngredients", () => {
  it("soma o mesmo ingrediente (nome+unidade) de receitas diferentes", () => {
    const result = sumIngredients([
      [{ qty: 200, unit: "g", name: "arroz" }],
      [{ qty: 100, unit: "g", name: "Arroz" }],
    ]);
    expect(result).toEqual([{ qty: 300, unit: "g", name: "arroz" }]);
  });

  it("unidades diferentes do mesmo nome não somam juntas", () => {
    const result = sumIngredients([
      [{ qty: 200, unit: "g", name: "arroz" }],
      [{ qty: 1, unit: "kg", name: "arroz" }],
    ]);
    expect(result).toHaveLength(2);
  });

  it("lista vazia devolve vazio", () => expect(sumIngredients([])).toEqual([]));
});
