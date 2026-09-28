import { describe, expect, it } from "vitest";
import { decodeTextBytes, detectCsvDelimiter, parseCsvRows } from "./csv";

describe("parseCsvRows", () => {
  it("quebra de linha, delimitador e aspas dentro de aspas ficam na mesma célula", () => {
    expect(parseCsvRows('item;obs\n"Caixas";"linha 1\nlinha 2; com ""aspas"""\n', ";")).toEqual([
      ["item", "obs"],
      ["Caixas", 'linha 1\nlinha 2; com "aspas"'],
    ]);
  });

  it("ignora BOM e linhas vazias (inclusive só com separadores)", () => {
    expect(parseCsvRows("﻿a,b\r\n\r\n,\r\n1,2", ",")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("detectCsvDelimiter", () => {
  it("Excel em português (;), Google (,) e tabulação", () => {
    expect(detectCsvDelimiter("Nome;Telefone;E-mail\nAna;1;a@b")).toBe(";");
    expect(detectCsvDelimiter("Name,Phone\nAna,1")).toBe(",");
    expect(detectCsvDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("vírgula dentro de aspas no cabeçalho não conta", () => {
    expect(detectCsvDelimiter('"Nome, completo";Telefone\n')).toBe(";");
  });
});

describe("decodeTextBytes", () => {
  it("UTF-8 válido passa; Windows-1252 (Excel no Windows) não vira �", () => {
    expect(decodeTextBytes(new TextEncoder().encode("Mudança"))).toBe("Mudança");
    expect(decodeTextBytes(new Uint8Array([0x4d, 0x75, 0x64, 0x61, 0x6e, 0xe7, 0x61]))).toBe("Mudança");
  });
});
