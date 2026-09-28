import { describe, expect, it } from "vitest";
import { detectCsvMapping, isMappingUsable } from "./detect-csv-mapping";
import { parseStatementCsv } from "./parse-statement-csv";

/** Mesmo layout do CSV do Bradesco (linha "Extrato de" antes do cabeçalho, `;`, crédito/débito separados, lixo no fim) — valores fictícios. */
const BRADESCO_LIKE = [
  "Extrato de: Ag: 0000 | Conta: 00000-0;;;;;",
  "Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)",
  "28/08/2026;COD. LANC. 0;0;0,00; ;0,00",
  "04/09/2026;TED C SAL P/ C CORRENTE;111;1.500,00; ;1.500,00",
  "04/09/2026;PIX ENVIADO;222; ;120,50;1.379,50",
  "10/09/2026;RENTAB.INVEST FACILCRED*;333;0,01; ;1.379,51",
  ";;;;;",
  "Filtro de resultados - Movimentação entre:  30/08/2026 e 28/09/2026;;;;;",
  "Últimos Lancamentos;;;;;",
  "Data;Histórico;Docto.;Crédito (R$);Débito (R$);",
  ";;;;Não há lançamentos disponíveis;;;;",
  ";;Total;0,00;0,00;0,00;",
].join("\n");

describe("detectCsvMapping", () => {
  it("formato Bradesco: `;`, pula a linha 'Extrato de', vírgula decimal e crédito/débito pelo nome do cabeçalho", () => {
    const detected = detectCsvMapping(BRADESCO_LIKE)!;

    expect(detected.delimiter).toBe(";");
    expect(detected.headerRowsToSkip).toBe(2);
    expect(detected.dateFormat).toBe("dd/MM/yyyy");
    expect(detected.decimalSeparator).toBe(",");
    expect(detected.columns).toEqual(["date", "description", "ignore", "credit", "debit", "ignore"]);
    expect(detected.headers[1]).toBe("Histórico");
  });

  it("o mapeamento detectado importa os lançamentos certos e só as linhas de lixo ficam com erro", () => {
    const detected = detectCsvMapping(BRADESCO_LIKE)!;
    const rows = parseStatementCsv(BRADESCO_LIKE, detected);
    const valid = rows.filter((r) => r.error === null);

    expect(valid.map((r) => [r.occurredOn, r.amountCents, r.description])).toEqual([
      ["2026-09-04", 150000, "TED C SAL P/ C CORRENTE"],
      ["2026-09-04", -12050, "PIX ENVIADO"],
      ["2026-09-10", 1, "RENTAB.INVEST FACILCRED*"],
    ]);
  });

  it("CSV com vírgula, data ISO e uma coluna só de valor", () => {
    const csv = ["date,description,amount", "2026-01-05,Mercado,-45.90", "2026-01-06,Salário,3000.00"].join("\n");
    const detected = detectCsvMapping(csv)!;

    expect(detected.delimiter).toBe(",");
    expect(detected.headerRowsToSkip).toBe(1);
    expect(detected.dateFormat).toBe("yyyy-MM-dd");
    expect(detected.decimalSeparator).toBe(".");
    expect(detected.columns).toEqual(["date", "description", "amount"]);
  });

  it("sem cabeçalho: acha descrição e valor pelo conteúdo das colunas", () => {
    const csv = ["05/01/2026;Padaria;-12,50", "06/01/2026;Farmácia;-30,00"].join("\n");
    const detected = detectCsvMapping(csv)!;

    expect(detected.headerRowsToSkip).toBe(0);
    expect(detected.headers).toEqual([]);
    expect(detected.columns).toEqual(["date", "description", "amount"]);
  });

  it("arquivo sem nenhuma data devolve null (a tela cai no mapeamento manual)", () => {
    expect(detectCsvMapping("nome;valor\nfulano;10,00")).toBeNull();
    expect(detectCsvMapping("")).toBeNull();
  });
});

describe("isMappingUsable", () => {
  const detected = detectCsvMapping(BRADESCO_LIKE)!;

  it("aceita um mapeamento salvo que bate com o arquivo", () => {
    expect(isMappingUsable({ ...detected }, detected)).toBe(true);
  });

  it("recusa um mapeamento salvo com outro separador (o caso que travava a tela em 'Vírgula')", () => {
    expect(isMappingUsable({ ...detected, delimiter: "," }, detected)).toBe(false);
  });

  it("recusa um mapeamento salvo sem colunas obrigatórias", () => {
    expect(isMappingUsable({ ...detected, columns: detected.columns.map(() => "ignore") }, detected)).toBe(false);
  });
});
