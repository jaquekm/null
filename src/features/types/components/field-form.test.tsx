// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FieldDefinition } from "../schemas";
import { FieldForm } from "./field-form";

vi.mock("../actions", () => ({ addField: vi.fn(async () => ({ ok: true, data: null })), updateField: vi.fn(async () => ({ ok: true, data: null })) }));

afterEach(cleanup);

const siblings: FieldDefinition[] = [
  { key: "quantidade", label: "Quantidade", type: "number", required: false },
  { key: "preco", label: "Preço", type: "money", required: false },
  { key: "obs", label: "Observação", type: "text", required: false },
];

describe("FieldForm — Fórmula", () => {
  it("oferece os campos numéricos, avisa erro e trava o salvar", () => {
    render(<FieldForm typeId="t1" otherTypes={[]} siblingFields={siblings} onCancel={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "" }) as HTMLSelectElement, { target: { value: "formula" } });

    // Só campos de número/dinheiro/porcentagem viram botão.
    expect(screen.getByRole("button", { name: "Quantidade" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Observação" })).toBeNull();

    const input = screen.getByLabelText("Fórmula") as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "Quantidade" }));
    expect(input.value).toBe("Quantidade");

    fireEvent.change(input, { target: { value: "Quantidade * frete" } });
    expect(screen.getByRole("alert").textContent).toBe("Não achei o campo “frete”.");
    expect((screen.getByRole("button", { name: "Salvar campo" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: "Quantidade × Preço" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByRole("button", { name: "Salvar campo" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText("Obrigatório")).toBeNull();
  });
});
