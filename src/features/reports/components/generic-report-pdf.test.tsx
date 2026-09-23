import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { ReportBlock } from "../lib/blocks";
import { GenericReportPdf } from "./generic-report-pdf";

const ALL_BLOCK_KINDS: ReportBlock[] = [
  { kind: "cards", items: [{ label: "Saldo", value: "R$ 100,00", tone: "emerald" }, { label: "Dívida", value: "R$ 50,00", tone: "red" }] },
  { kind: "list", title: "Lista", rows: [{ label: "Item 1", sublabel: "2026-09-01", value: "R$ 10,00", tone: "emerald" }] },
  { kind: "list", title: "Lista vazia", rows: [], emptyText: "Nada aqui." },
  { kind: "bars", title: "Barras", rows: [{ label: "Categoria A", valueLabel: "80%", percent: 80, status: "warning" }] },
  { kind: "bars", title: "Barras vazias", rows: [], emptyText: "Sem dados." },
  {
    kind: "table",
    title: "Tabela",
    columns: [
      { key: "a", label: "A" },
      { key: "b", label: "B", align: "right" },
    ],
    rows: [{ a: "x", b: "y" }],
  },
  { kind: "table", title: "Tabela vazia", columns: [{ key: "a", label: "A" }], rows: [], emptyText: "Sem linhas." },
  { kind: "text", title: "Texto", body: "Um parágrafo de texto simples." },
  { kind: "text", body: "Texto sem título." },
];

// Cada `kind` de ReportBlock, inclusive os casos vazios — cobre os 8 relatórios de 6.2b que usam esse renderizador genérico (só finance_monthly tem PDF próprio).
describe("GenericReportPdf", () => {
  it("renderiza todo tipo de bloco sem lançar e produz um PDF válido", async () => {
    const buffer = await renderToBuffer(<GenericReportPdf title="Relatório de teste" subtitle="Período de teste" blocks={ALL_BLOCK_KINDS} />);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("renderiza sem blocos", async () => {
    const buffer = await renderToBuffer(<GenericReportPdf title="Vazio" subtitle="—" blocks={[]} />);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
