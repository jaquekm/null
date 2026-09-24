import { describe, expect, it } from "vitest";
import { buildCsv, csvEscape } from "./csv";

describe("csvEscape", () => {
  it("não mexe em valor simples", () => {
    expect(csvEscape("simples")).toBe("simples");
  });

  it("envolve em aspas e dobra aspas internas quando há ; \" ou quebra de linha", () => {
    expect(csvEscape('a;b')).toBe('"a;b"');
    expect(csvEscape('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvEscape("linha1\nlinha2")).toBe('"linha1\nlinha2"');
  });
});

describe("buildCsv", () => {
  it("monta CSV com BOM, separador ; e \\r\\n", () => {
    const csv = buildCsv(["Nome", "Idade"], [["Ana", "30"], ["João;Neto", "40"]]);
    expect(csv).toBe('﻿Nome;Idade\r\nAna;30\r\n"João;Neto";40');
  });
});
