import { describe, expect, it } from "vitest";
import { parseAnkiExport } from "./anki-import";

describe("parseAnkiExport", () => {
  it("separa por ; (formato do enunciado)", () => {
    expect(parseAnkiExport("Capital da França;Paris\nCapital da Itália;Roma")).toEqual([
      { front: "Capital da França", back: "Paris" },
      { front: "Capital da Itália", back: "Roma" },
    ]);
  });

  it("separa por tab (exportação real do Anki)", () => {
    expect(parseAnkiExport("Pergunta\tResposta")).toEqual([{ front: "Pergunta", back: "Resposta" }]);
  });

  it("ignora linha de cabeçalho frente/verso ou front/back", () => {
    expect(parseAnkiExport("Frente;Verso\nA;B")).toEqual([{ front: "A", back: "B" }]);
    expect(parseAnkiExport("Front;Back\nA;B")).toEqual([{ front: "A", back: "B" }]);
  });

  it("converte <br>/<div> em quebra de linha e remove outras tags", () => {
    expect(parseAnkiExport("O que é <b>HTTP</b>?;Protocolo<br>de transferência<div>de hipertexto</div>")).toEqual([
      { front: "O que é HTTP?", back: "Protocolo\nde transferência\nde hipertexto" },
    ]);
  });

  it("ignora linhas vazias e sem separador", () => {
    expect(parseAnkiExport("A;B\n\nlinha sem separador\nC;D")).toEqual([
      { front: "A", back: "B" },
      { front: "C", back: "D" },
    ]);
  });

  it("ignora linha com frente ou verso vazios", () => {
    expect(parseAnkiExport(";vazio\nvazio;\nA;B")).toEqual([{ front: "A", back: "B" }]);
  });
});
