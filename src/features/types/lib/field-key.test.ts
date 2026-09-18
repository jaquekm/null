import { describe, expect, it } from "vitest";
import { fieldKeyFromLabel, uniqueFieldKey } from "./field-key";

describe("fieldKeyFromLabel", () => {
  it("converte label em key com underscore", () => {
    expect(fieldKeyFromLabel("Revisar em")).toBe("revisar_em");
  });

  it("remove acentos", () => {
    expect(fieldKeyFromLabel("Situação")).toBe("situacao");
  });

  it("prefixa 'campo_' quando o resultado começaria com número", () => {
    expect(fieldKeyFromLabel("2ª via")).toBe("campo_2_via");
  });

  it("sempre casa com o regex de fieldDefinitionSchema.key", () => {
    expect(fieldKeyFromLabel("Prioridade")).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(fieldKeyFromLabel("!!!")).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});

describe("uniqueFieldKey", () => {
  it("usa a key normal quando não há colisão", () => {
    expect(uniqueFieldKey("Prazo", [])).toBe("prazo");
  });

  it("adiciona sufixo numérico em colisão", () => {
    expect(uniqueFieldKey("Prazo", ["prazo"])).toBe("prazo_2");
    expect(uniqueFieldKey("Prazo", ["prazo", "prazo_2"])).toBe("prazo_3");
  });
});
