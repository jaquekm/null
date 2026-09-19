import { describe, expect, it } from "vitest";
import { chunkPageIndices } from "./chunk-page-indices";

describe("chunkPageIndices", () => {
  it("divide em blocos do tamanho pedido", () => {
    expect(chunkPageIndices(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
  });

  it("cabe tudo num bloco só quando o total é menor que o tamanho do bloco", () => {
    expect(chunkPageIndices(3, 10)).toEqual([[0, 1, 2]]);
  });

  it("0 páginas dá lista vazia", () => {
    expect(chunkPageIndices(0, 10)).toEqual([]);
  });

  it("bloco exato (múltiplo perfeito) não sobra um bloco vazio", () => {
    expect(chunkPageIndices(4, 2)).toEqual([[0, 1], [2, 3]]);
  });
});
