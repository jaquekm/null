import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@/features/types/schemas";
import { buildPublicProperties } from "./build-public-item";

function field(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return { key: "prazo", label: "Prazo", type: "date", required: false, ...overrides };
}

describe("buildPublicProperties", () => {
  it("inclui campos com valor preenchido", () => {
    const result = buildPublicProperties({ prazo: "2026-01-10" }, [field()]);
    expect(result).toEqual([{ key: "prazo", label: "Prazo", value: "10/01/2026" }]);
  });

  it("campo marcado hidden: fora", () => {
    const result = buildPublicProperties({ prazo: "2026-01-10" }, [field({ hidden: true })]);
    expect(result).toEqual([]);
  });

  it("campo relation: fora (aponta pra outro item)", () => {
    const result = buildPublicProperties({ vinculo: ["item-1"] }, [field({ key: "vinculo", label: "Vínculo", type: "relation" })]);
    expect(result).toEqual([]);
  });

  it("campo contact: fora (aponta pra um contato)", () => {
    const result = buildPublicProperties({ responsavel: ["contact-1"] }, [field({ key: "responsavel", label: "Responsável", type: "contact" })]);
    expect(result).toEqual([]);
  });

  it("campo file: fora (caminho de storage cru)", () => {
    const result = buildPublicProperties({ anexo: "path/x.pdf" }, [field({ key: "anexo", label: "Anexo", type: "file" })]);
    expect(result).toEqual([]);
  });

  it("campo sem valor: fora", () => {
    const result = buildPublicProperties({}, [field()]);
    expect(result).toEqual([]);
  });

  it("select formata pelo label da opção", () => {
    const result = buildPublicProperties(
      { status: "opt-1" },
      [field({ key: "status", label: "Status", type: "select", options: [{ id: "opt-1", label: "Em andamento" }] })],
    );
    expect(result).toEqual([{ key: "status", label: "Status", value: "Em andamento" }]);
  });
});
