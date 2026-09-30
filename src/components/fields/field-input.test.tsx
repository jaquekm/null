// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FieldInput } from "./field-input";

vi.mock("@/features/items/actions", () => ({ updateItemProperty: vi.fn(async () => ({ ok: true, data: null })) }));

afterEach(cleanup);

describe("FieldInput — dinheiro", () => {
  it("mostra e aceita reais (não centavos)", () => {
    render(<FieldInput itemId="i1" field={{ key: "preco", label: "Preço", type: "money", required: false }} value={123456} updatedAt="t" onSaved={vi.fn()} />);
    const input = screen.getByDisplayValue("1.234,56") as HTMLInputElement;
    expect(input.getAttribute("inputmode")).toBe("decimal");
    expect(screen.getByText("R$")).toBeTruthy();
    expect(screen.queryByText(/centavos/)).toBeNull();
  });

  it("fórmula aparece pronta, só leitura", () => {
    render(
      <FieldInput
        itemId="i1"
        field={{ key: "total", label: "Total", type: "formula", formula: "a*b", formulaFormat: "money", required: false }}
        value={5180}
        updatedAt="t"
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByText(/R\$\s51,80/)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
