import { describe, expect, it } from "vitest";
import type { TagOption } from "@/features/tags/queries";
import { extractTagFilter } from "./extract-tag-filter";

const tags: TagOption[] = [
  { id: "tag-1", name: "trabalho", color: null },
  { id: "tag-2", name: "urgente", color: null },
];

describe("extractTagFilter", () => {
  it("sem #tag no texto, devolve o texto igual e tagId nulo", () => {
    expect(extractTagFilter("relatório mensal", tags)).toEqual({ text: "relatório mensal", tagId: null });
  });

  it("reconhece #tag que bate com uma tag existente e tira do texto", () => {
    expect(extractTagFilter("#trabalho relatório", tags)).toEqual({ text: "relatório", tagId: "tag-1" });
  });

  it("reconhece a tag em qualquer posição do texto", () => {
    expect(extractTagFilter("relatório #trabalho mensal", tags)).toEqual({ text: "relatório  mensal", tagId: "tag-1" });
  });

  it("é insensível a maiúsculas/minúsculas", () => {
    expect(extractTagFilter("#Trabalho", tags)).toEqual({ text: "", tagId: "tag-1" });
  });

  it("#tag que não bate com nenhuma tag existente não filtra nada, texto fica igual", () => {
    expect(extractTagFilter("#inexistente algo", tags)).toEqual({ text: "#inexistente algo", tagId: null });
  });

  it("query só com o #tag vira texto vazio (busca só pela tag, sem texto)", () => {
    expect(extractTagFilter("#urgente", tags)).toEqual({ text: "", tagId: "tag-2" });
  });
});
