// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FieldDefinition } from "@/features/types/schemas";
import type { ViewItemRow } from "../queries";
import { TableView } from "./table-view";

vi.mock("@/components/fields/field-input", () => ({
  FieldInput: ({ value }: { value: unknown }) => <span>{String(value ?? "")}</span>,
}));

afterEach(cleanup);

const fields: FieldDefinition[] = [
  { key: "qtd", label: "Quantidade", type: "number", required: false },
  { key: "preco", label: "Preço", type: "money", required: false },
  { key: "nota", label: "Nota", type: "rating", required: false },
  { key: "total", label: "Total", type: "formula", formula: "qtd * preco", formulaFormat: "money", required: false },
  { key: "obs", label: "Obs", type: "text", required: false },
];

const row = (id: string, properties: Record<string, unknown>): ViewItemRow => ({
  id,
  title: `Item ${id}`,
  status: "active",
  spaceId: "s",
  typeId: "t",
  properties,
  updatedAt: "t",
  createdAt: "t",
  position: 0,
  tags: [],
  coverPath: null,
  content: null,
});

function renderTable(onTotalAggChange = vi.fn()) {
  render(
    <TableView
      rows={[row("1", { qtd: 2, preco: 1050, nota: 4 }), row("2", { qtd: 1, preco: 999, nota: 5 })]}
      fields={fields}
      sort={[]}
      onSortChange={vi.fn()}
      onVisibleFieldsChange={vi.fn()}
      onItemSaved={vi.fn()}
      total={30}
      totals={{ qtd: { sum: 45, count: 30 }, preco: { sum: 312345, count: 29 }, nota: { sum: 90, count: 20 }, total: { sum: 500000, count: 28 } }}
      totalAggs={{ qtd: "count" }}
      onTotalAggChange={onTotalAggChange}
    />,
  );
  return screen.getByRole("table").querySelector("tfoot")!;
}

describe("TableView — linha de totais", () => {
  it("mostra o total do filtro inteiro, no formato de cada coluna", () => {
    const foot = renderTable();
    const text = foot.textContent ?? "";
    expect(text).toContain("Total · 30 itens");
    expect(text).toContain("30"); // contagem escolhida pra Quantidade
    expect(text).toContain("R$ 3.123,45"); // soma do preço
    expect(text).toContain("4,5"); // média da nota (padrão)
    expect(text).toContain("R$ 5.000,00"); // soma da fórmula em dinheiro
  });

  it("trocar o cálculo avisa a visão", () => {
    const onChange = vi.fn();
    const foot = renderTable(onChange);
    fireEvent.change(within(foot).getByLabelText("Cálculo do total de Preço"), { target: { value: "avg" } });
    expect(onChange).toHaveBeenCalledWith("preco", "avg");
  });

  it("coluna calculada (fórmula) não ordena", () => {
    renderTable();
    const header = screen.getByRole("columnheader", { name: "Total" });
    fireEvent.click(within(header).getByRole("button"));
    // Sem ícone de ordenação e sem mudança — só confere que o botão existe e nada quebra.
    expect(header.querySelector("svg")).toBeNull();
  });
});
