import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { FinanceMonthlyData } from "../generators/finance-monthly";
import { FinanceMonthlyPdf } from "./finance-monthly-pdf";

const DATA: FinanceMonthlyData = {
  month: "2026-09",
  label: "setembro de 2026",
  cards: {
    totalBalanceCents: 500_000,
    incomeCents: 800_000,
    expenseCents: -650_000,
    resultCents: 150_000,
    openCardDebtCents: 120_000,
    receivableOpenCents: 30_000,
    splitBalanceCents: -5_000,
  },
  initialBalanceCents: 350_000,
  previousMonthResultCents: 100_000,
  avgResultLast3MonthsCents: 120_000,
  categoryBudget: [
    { categoryId: "c1", categoryName: "Mercado", spentCents: -90_000, budgetCents: 80_000, percent: 112.5, status: "over" },
    { categoryId: "c2", categoryName: "Lazer", spentCents: -20_000, budgetCents: 50_000, percent: 40, status: "under" },
  ],
  topExpenses: [{ id: "t1", description: "Aluguel", amountCents: -180_000, occurredOn: "2026-09-05", categoryId: null, kind: "normal" }],
  cardStatements: [{ accountName: "Nubank", totalCents: 120_000, status: "closed", dueOn: "2026-09-10" }],
  billsPaid: [{ description: "Internet", amountCents: -12_000, direction: "payable" }],
  billsOpen: [{ description: "Consulta médica", amountCents: 30_000, dueOn: "2026-09-28", direction: "receivable" }],
  splitBalanceCents: -5_000,
};

// Só confere que a árvore de componentes vira um PDF de verdade (nada de layout/fonte quebrando em runtime) — sem asserção sobre o conteúdo do PDF em si.
describe("FinanceMonthlyPdf", () => {
  it("renderiza sem lançar e produz um PDF válido", async () => {
    const buffer = await renderToBuffer(<FinanceMonthlyPdf data={DATA} />);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("renderiza com listas vazias (mês sem categoria com orçamento, sem faturas)", async () => {
    const empty: FinanceMonthlyData = { ...DATA, categoryBudget: [], topExpenses: [], cardStatements: [], billsPaid: [], billsOpen: [], previousMonthResultCents: null };
    const buffer = await renderToBuffer(<FinanceMonthlyPdf data={empty} />);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
