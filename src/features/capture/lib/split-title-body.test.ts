import { describe, expect, it } from "vitest";
import { splitTitleAndBody } from "./split-title-body";

describe("splitTitleAndBody", () => {
  it("uma linha só vira título, corpo vazio", () => {
    expect(splitTitleAndBody("Só título")).toEqual({ title: "Só título", body: "" });
  });

  it("primeira linha vira título, resto vira corpo", () => {
    expect(splitTitleAndBody("Título\nCorpo linha 1\nCorpo linha 2")).toEqual({
      title: "Título",
      body: "Corpo linha 1\nCorpo linha 2",
    });
  });

  it("remove espaços em volta do título", () => {
    expect(splitTitleAndBody("  Título com espaço  \nCorpo")).toEqual({ title: "Título com espaço", body: "Corpo" });
  });

  it("ignora quebras de linha no começo", () => {
    expect(splitTitleAndBody("\n\nTítulo\nCorpo")).toEqual({ title: "Título", body: "Corpo" });
  });

  it("string vazia vira título e corpo vazios", () => {
    expect(splitTitleAndBody("")).toEqual({ title: "", body: "" });
  });
});
