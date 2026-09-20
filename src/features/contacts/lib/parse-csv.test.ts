import { describe, expect, it } from "vitest";
import { parseCsv } from "./parse-csv";

describe("parseCsv", () => {
  it("separa cabeçalho e linhas simples", () => {
    const result = parseCsv("nome,telefone\nJoão,11987654321\nMaria,11912345678");
    expect(result.headers).toEqual(["nome", "telefone"]);
    expect(result.rows).toEqual([
      ["João", "11987654321"],
      ["Maria", "11912345678"],
    ]);
  });

  it("respeita campos entre aspas com vírgula dentro", () => {
    const result = parseCsv('nome,endereco\n"Silva, João","Rua A, 123"');
    expect(result.rows).toEqual([["Silva, João", "Rua A, 123"]]);
  });

  it("decodifica aspas escapadas (\"\") dentro de um campo entre aspas", () => {
    const result = parseCsv('nome,apelido\n"Ana","O ""Chefe"""');
    expect(result.rows[0]).toEqual(["Ana", 'O "Chefe"']);
  });

  it("aceita campo entre aspas com quebra de linha dentro", () => {
    const result = parseCsv('nome,nota\n"João","Linha um\nLinha dois"');
    expect(result.rows[0]).toEqual(["João", "Linha um\nLinha dois"]);
  });

  it("funciona com quebras de linha CRLF", () => {
    const result = parseCsv("nome,tel\r\nJoão,123\r\nMaria,456");
    expect(result.rows).toEqual([
      ["João", "123"],
      ["Maria", "456"],
    ]);
  });

  it("ignora linhas em branco no fim do arquivo", () => {
    const result = parseCsv("nome,tel\nJoão,123\n\n");
    expect(result.rows).toEqual([["João", "123"]]);
  });

  it("CSV só com cabeçalho devolve zero linhas de dado", () => {
    const result = parseCsv("nome,tel");
    expect(result.headers).toEqual(["nome", "tel"]);
    expect(result.rows).toEqual([]);
  });
});
