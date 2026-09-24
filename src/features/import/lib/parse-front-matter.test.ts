import { describe, expect, it } from "vitest";
import { parseFrontMatter } from "./parse-front-matter";

describe("parseFrontMatter", () => {
  it("sem front matter: body é o conteúdo inteiro, data vazio", () => {
    expect(parseFrontMatter("só texto normal")).toEqual({ data: {}, body: "só texto normal" });
  });

  it("valores simples e lista inline", () => {
    const result = parseFrontMatter(['---', 'title: Minha nota', 'status: ativo', 'tags: [foo, bar]', '---', 'Corpo aqui.'].join("\n"));
    expect(result.data).toEqual({ title: "Minha nota", status: "ativo", tags: ["foo", "bar"] });
    expect(result.body).toBe("Corpo aqui.");
  });

  it("lista em bloco", () => {
    const result = parseFrontMatter(['---', 'tags:', '  - um', '  - dois', '---', 'corpo'].join("\n"));
    expect(result.data.tags).toEqual(["um", "dois"]);
  });

  it("valor entre aspas simples ou duplas é desaspado", () => {
    const result = parseFrontMatter(['---', 'title: "Com: dois pontos"', "subtitle: 'aspas simples'", '---', ''].join("\n"));
    expect(result.data.title).toBe("Com: dois pontos");
    expect(result.data.subtitle).toBe("aspas simples");
  });
});
