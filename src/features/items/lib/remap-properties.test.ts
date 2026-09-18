import { describe, expect, it } from "vitest";
import { remapProperties } from "./remap-properties";

describe("remapProperties", () => {
  it("mantém só as chaves presentes no tipo novo", () => {
    const result = remapProperties({ status: "todo", prazo: "2026-01-01", extra: "x" }, ["status", "prazo"]);
    expect(result).toEqual({ status: "todo", prazo: "2026-01-01" });
  });

  it("descarta tudo quando o tipo novo não tem campos", () => {
    expect(remapProperties({ a: 1, b: 2 }, [])).toEqual({});
  });

  it("não inventa valores para chaves do tipo novo que o item não tinha", () => {
    const result = remapProperties({ status: "todo" }, ["status", "prioridade"]);
    expect(result).toEqual({ status: "todo" });
  });

  it("preserva o valor original sem conversão", () => {
    const result = remapProperties({ concluida: true, tags: ["a", "b"] }, ["concluida", "tags"]);
    expect(result).toEqual({ concluida: true, tags: ["a", "b"] });
  });
});
