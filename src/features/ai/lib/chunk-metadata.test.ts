import { describe, expect, it } from "vitest";
import { describeChunkLocation, extractPage, extractSeekSeconds } from "./chunk-metadata";

describe("extractSeekSeconds", () => {
  it("metadata.start numérico: devolve o valor", () => {
    expect(extractSeekSeconds({ start: 800 })).toBe(800);
  });
  it("sem start: null", () => {
    expect(extractSeekSeconds({ page: 2 })).toBeNull();
    expect(extractSeekSeconds(null)).toBeNull();
  });
});

describe("extractPage", () => {
  it("metadata.page numérico: devolve o valor", () => {
    expect(extractPage({ page: 3 })).toBe(3);
  });
  it("sem page: null", () => {
    expect(extractPage({ start: 10 })).toBeNull();
  });
});

describe("describeChunkLocation", () => {
  it("trecho de transcrição vira 'trecho HH:MM:SS'", () => {
    expect(describeChunkLocation({ start: 750 })).toBe("trecho 00:12:30");
  });
  it("trecho de anexo vira 'página N'", () => {
    expect(describeChunkLocation({ page: 4 })).toBe("página 4");
  });
  it("trecho de conteúdo com seção vira 'seção \"X\"'", () => {
    expect(describeChunkLocation({ title: "Nota", section: "Decisões" })).toBe('seção "Decisões"');
  });
  it("sem nada específico (propriedades, conteúdo sem seção): vazio", () => {
    expect(describeChunkLocation({})).toBe("");
    expect(describeChunkLocation({ title: "Nota", section: null })).toBe("");
  });
});
