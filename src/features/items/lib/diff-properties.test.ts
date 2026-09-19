import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@/features/types/schemas";
import { diffProperties } from "./diff-properties";

const statusField: FieldDefinition = {
  key: "status",
  label: "Status",
  type: "select",
  required: false,
  options: [
    { id: "a", label: "A fazer" },
    { id: "b", label: "Feito" },
  ],
};
const priceField: FieldDefinition = { key: "preco", label: "Preço", type: "money", required: false, currency: "BRL" };
const noteField: FieldDefinition = { key: "obs", label: "Obs", type: "text", required: false };

describe("diffProperties", () => {
  it("não retorna nada quando nenhum campo mudou", () => {
    const props = { status: "a", preco: 1000, obs: "oi" };
    expect(diffProperties(props, { ...props }, [statusField, priceField, noteField])).toEqual([]);
  });

  it("retorna só os campos cujo valor formatado mudou", () => {
    const oldProps = { status: "a", preco: 1000, obs: "oi" };
    const newProps = { status: "b", preco: 1000, obs: "oi" };
    expect(diffProperties(oldProps, newProps, [statusField, priceField, noteField])).toEqual([
      { key: "status", label: "Status", oldValue: "A fazer", newValue: "Feito" },
    ]);
  });

  it("valor ausente em um dos lados também conta como mudança", () => {
    const oldProps = { obs: "antes" };
    const newProps = {};
    expect(diffProperties(oldProps, newProps, [noteField])).toEqual([
      { key: "obs", label: "Obs", oldValue: "antes", newValue: "—" },
    ]);
  });

  it("ignora campos que não existem em nenhum dos dois lados", () => {
    expect(diffProperties({}, {}, [statusField])).toEqual([]);
  });
});
