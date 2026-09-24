import type { Cents } from "@/lib/money";
import { buildCsv } from "./csv";

function formatCsvAmount(cents: Cents): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export interface AccountForCsv {
  name: string;
  kind: string;
  institution: string | null;
  spaceName: string | null;
  openingBalanceCents: Cents;
  openingDate: string;
  creditLimitCents: Cents | null;
  includeInTotals: boolean;
}

const ACCOUNTS_HEADER = ["Nome", "Tipo", "Instituição", "Espaço", "Saldo inicial", "Data inicial", "Limite de crédito", "Entra nos totais"];

export function buildAccountsCsv(accounts: AccountForCsv[]): string {
  return buildCsv(
    ACCOUNTS_HEADER,
    accounts.map((a) => [
      a.name,
      a.kind,
      a.institution ?? "",
      a.spaceName ?? "",
      formatCsvAmount(a.openingBalanceCents),
      a.openingDate,
      a.creditLimitCents != null ? formatCsvAmount(a.creditLimitCents) : "",
      a.includeInTotals ? "Sim" : "Não",
    ]),
  );
}

export interface BillForCsv {
  direction: "payable" | "receivable";
  description: string;
  contactName: string | null;
  categoryName: string | null;
  accountName: string | null;
  amountCents: Cents;
  paidCents: Cents;
  dueOn: string;
  status: string;
}

const BILLS_HEADER = ["Direção", "Descrição", "Contato", "Categoria", "Conta", "Valor", "Pago", "Vencimento", "Status"];

export function buildBillsCsv(bills: BillForCsv[]): string {
  return buildCsv(
    BILLS_HEADER,
    bills.map((b) => [
      b.direction === "payable" ? "A pagar" : "A receber",
      b.description,
      b.contactName ?? "",
      b.categoryName ?? "",
      b.accountName ?? "",
      formatCsvAmount(b.amountCents),
      formatCsvAmount(b.paidCents),
      b.dueOn,
      b.status,
    ]),
  );
}

export interface SplitShareForCsv {
  title: string;
  occurredOn: string;
  totalCents: Cents;
  paidByName: string;
  method: string;
  groupLabel: string | null;
  status: string;
  shareContactName: string;
  shareCents: Cents;
  settledCents: Cents;
}

const SPLITS_HEADER = ["Divisão", "Data", "Total", "Pago por", "Método", "Grupo", "Status", "Parte de", "Valor da parte", "Já acertado"];

export function buildSplitsCsv(shares: SplitShareForCsv[]): string {
  return buildCsv(
    SPLITS_HEADER,
    shares.map((s) => [
      s.title,
      s.occurredOn,
      formatCsvAmount(s.totalCents),
      s.paidByName,
      s.method,
      s.groupLabel ?? "",
      s.status,
      s.shareContactName,
      formatCsvAmount(s.shareCents),
      formatCsvAmount(s.settledCents),
    ]),
  );
}
