import { describe, expect, it } from "vitest";
import { parseSnippet } from "./parse-snippet";

describe("parseSnippet", () => {
  it("texto sem marcação vira um único segmento", () => {
    expect(parseSnippet("texto qualquer")).toEqual([{ text: "texto qualquer", marked: false }]);
  });

  it("separa texto marcado do texto ao redor", () => {
    expect(parseSnippet("antes <mark>meio</mark> depois")).toEqual([
      { text: "antes ", marked: false },
      { text: "meio", marked: true },
      { text: " depois", marked: false },
    ]);
  });

  it("lida com múltiplas marcações", () => {
    expect(parseSnippet("<mark>um</mark> e <mark>dois</mark>")).toEqual([
      { text: "um", marked: true },
      { text: " e ", marked: false },
      { text: "dois", marked: true },
    ]);
  });

  it("string vazia vira lista vazia", () => {
    expect(parseSnippet("")).toEqual([]);
  });

  it("preserva caracteres < e > que não fazem parte de <mark>/</mark>, sem tratar como tag", () => {
    expect(parseSnippet("se x < 5 e y > 2")).toEqual([{ text: "se x < 5 e y > 2", marked: false }]);
  });
});
