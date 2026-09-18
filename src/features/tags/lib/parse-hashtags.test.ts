import { describe, expect, it } from "vitest";
import { parseHashtags } from "./parse-hashtags";

describe("parseHashtags", () => {
  it("retorna array vazio quando não há hashtags", () => {
    expect(parseHashtags("nada aqui")).toEqual([]);
  });

  it("extrai uma hashtag simples", () => {
    expect(parseHashtags("Reunião #trabalho hoje")).toEqual(["trabalho"]);
  });

  it("normaliza para minúsculo", () => {
    expect(parseHashtags("#Urgente #URGENTE")).toEqual(["urgente"]);
  });

  it("aceita acentos", () => {
    expect(parseHashtags("#saúde #importação")).toEqual(["saúde", "importação"]);
  });

  it("aceita hífen no meio da tag", () => {
    expect(parseHashtags("#tarefa-urgente")).toEqual(["tarefa-urgente"]);
  });

  it("não inclui o # nem pontuação de fechamento", () => {
    expect(parseHashtags("veja #ideias, por favor")).toEqual(["ideias"]);
  });

  it("retorna múltiplas tags na ordem em que aparecem, sem duplicatas", () => {
    expect(parseHashtags("#a #b #a #c")).toEqual(["a", "b", "c"]);
  });

  it("ignora um # sozinho ou seguido de espaço", () => {
    expect(parseHashtags("# não é tag, nem # ")).toEqual([]);
  });
});
