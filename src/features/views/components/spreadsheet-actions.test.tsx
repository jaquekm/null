// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FieldDefinition } from "@/features/types/schemas";
import { SpreadsheetActions } from "./spreadsheet-actions";

const importSpreadsheetRows = vi.fn<(input: { rows: unknown[] }) => Promise<{ ok: true; data: { created: number; droppedValues: number } }>>(async (input) => ({
  ok: true,
  data: { created: input.rows.length, droppedValues: 0 },
}));
vi.mock("../actions", () => ({
  exportViewSpreadsheet: vi.fn(),
  importSpreadsheetRows: (input: { rows: unknown[] }) => importSpreadsheetRows(input),
}));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (m: string) => toastSuccess(m), error: vi.fn(), message: vi.fn() } }));

afterEach(() => {
  cleanup();
  importSpreadsheetRows.mockClear();
});

const fields: FieldDefinition[] = [
  { key: "preco", label: "Preço", type: "money", required: false },
  { key: "pago", label: "Pago", type: "checkbox", required: false },
];

describe("SpreadsheetActions — importar", () => {
  it("lê o CSV, mostra como cada coluna entra e cria os itens", async () => {
    const onImported = vi.fn();
    render(<SpreadsheetActions spaceId="s1" typeId="t1" viewName="Contas" fields={fields} filters={[]} sort={[]} onImported={onImported} />);
    const file = new File(["Nome;Preço;Pago;Obs\nLuz;R$ 142,50;sim;x\nÁgua;80;não;\n"], "contas.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Escolher planilha"), { target: { files: [file] } });

    const dialog = await screen.findByRole("dialog", { name: "Importar planilha" });
    expect(dialog.textContent).toContain("2 linhas vão virar itens");
    expect(dialog.textContent).toContain("→ Título");
    expect(dialog.textContent).toContain("→ Preço");
    expect(dialog.textContent).toContain("não entra");

    // A prévia já abre pronta pra confirmar (não "Importando…").
    fireEvent.click(await screen.findByRole("button", { name: "Importar 2 itens" }));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(importSpreadsheetRows).toHaveBeenCalledWith({
      spaceId: "s1",
      typeId: "t1",
      rows: [
        { title: "Luz", properties: { preco: 14250, pago: true } },
        { title: "Água", properties: { preco: 8000, pago: false } },
      ],
    });
    expect(toastSuccess).toHaveBeenCalledWith("2 itens importados.");
  });

  it("sem espaço/tipo, só dá pra baixar", () => {
    render(<SpreadsheetActions spaceId={null} typeId={null} viewName="Tudo" fields={[]} filters={[]} sort={[]} onImported={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Baixar Excel/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Importar planilha/ })).toBeNull();
  });
});
