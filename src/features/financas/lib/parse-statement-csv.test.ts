import { describe, expect, it } from "vitest";
import { parseStatementCsv, type CsvImportMapping } from "./parse-statement-csv";

describe("parseStatementCsv", () => {
  it("coluna de valor única, ; e vírgula decimal, dd/MM/yyyy", () => {
    const content = ["Data;Descricao;Valor", "05/01/2026;PADARIA SILVA;-45,90", "10/01/2026;SALARIO EMPRESA X;1.500,00"].join("\n");
    const mapping: CsvImportMapping = { delimiter: ";", decimalSeparator: ",", dateFormat: "dd/MM/yyyy", headerRowsToSkip: 1, columns: ["date", "description", "amount"] };

    const rows = parseStatementCsv(content, mapping);
    expect(rows).toEqual([
      { fitid: null, occurredOn: "2026-01-05", amountCents: -4590, description: "PADARIA SILVA", error: null },
      { fitid: null, occurredOn: "2026-01-10", amountCents: 150000, description: "SALARIO EMPRESA X", error: null },
    ]);
  });

  it("débito/crédito em colunas separadas, vírgula e ponto decimal, yyyy-MM-dd", () => {
    const content = ["Date,Description,Debit,Credit", "2026-01-05,PADARIA SILVA,45.90,", "2026-01-10,SALARIO EMPRESA X,,1500.00"].join("\n");
    const mapping: CsvImportMapping = { delimiter: ",", decimalSeparator: ".", dateFormat: "yyyy-MM-dd", headerRowsToSkip: 1, columns: ["date", "description", "debit", "credit"] };

    const rows = parseStatementCsv(content, mapping);
    expect(rows[0]).toMatchObject({ occurredOn: "2026-01-05", amountCents: -4590, error: null });
    expect(rows[1]).toMatchObject({ occurredOn: "2026-01-10", amountCents: 150000, error: null });
  });

  it("descrição entre aspas contendo o próprio delimitador", () => {
    const content = ['Data;Descricao;Valor', '05/01/2026;"Mercado; Compra grande";-120,00'].join("\n");
    const mapping: CsvImportMapping = { delimiter: ";", decimalSeparator: ",", dateFormat: "dd/MM/yyyy", headerRowsToSkip: 1, columns: ["date", "description", "amount"] };

    const rows = parseStatementCsv(content, mapping);
    expect(rows[0]).toEqual({ fitid: null, occurredOn: "2026-01-05", amountCents: -12000, description: "Mercado; Compra grande", error: null });
  });

  it("pula N linhas de cabeçalho (ex.: linha de resumo antes do header de verdade)", () => {
    const content = ["Extrato conta 12345", "Data;Descricao;Valor", "05/01/2026;TESTE;-10,00"].join("\n");
    const mapping: CsvImportMapping = { delimiter: ";", decimalSeparator: ",", dateFormat: "dd/MM/yyyy", headerRowsToSkip: 2, columns: ["date", "description", "amount"] };

    const rows = parseStatementCsv(content, mapping);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.description).toBe("TESTE");
  });

  it("valor não numérico: linha com erro, continua na lista", () => {
    const content = ["Data;Descricao;Valor", "05/01/2026;SEM VALOR;abc"].join("\n");
    const mapping: CsvImportMapping = { delimiter: ";", decimalSeparator: ",", dateFormat: "dd/MM/yyyy", headerRowsToSkip: 1, columns: ["date", "description", "amount"] };

    const rows = parseStatementCsv(content, mapping);
    expect(rows[0]?.amountCents).toBeNull();
    expect(rows[0]?.error).toContain("valor inválido");
  });

  it("data em formato errado: erro de data", () => {
    const content = ["Data;Descricao;Valor", "2026-01-05;TESTE;-10,00"].join("\n"); // mapeamento espera dd/MM/yyyy
    const mapping: CsvImportMapping = { delimiter: ";", decimalSeparator: ",", dateFormat: "dd/MM/yyyy", headerRowsToSkip: 1, columns: ["date", "description", "amount"] };

    const rows = parseStatementCsv(content, mapping);
    expect(rows[0]?.occurredOn).toBeNull();
    expect(rows[0]?.error).toContain("data inválida");
  });

  it("prefixo R$ e valor entre parênteses (negativo)", () => {
    const content = ["Data;Descricao;Valor", "05/01/2026;COM PREFIXO;R$ 45,90", "05/01/2026;NEGATIVO EM PARENTESES;(45,90)"].join("\n");
    const mapping: CsvImportMapping = { delimiter: ";", decimalSeparator: ",", dateFormat: "dd/MM/yyyy", headerRowsToSkip: 1, columns: ["date", "description", "amount"] };

    const rows = parseStatementCsv(content, mapping);
    expect(rows[0]?.amountCents).toBe(4590);
    expect(rows[1]?.amountCents).toBe(-4590);
  });

  it("linhas em branco no meio do arquivo são ignoradas", () => {
    const content = ["Data;Descricao;Valor", "", "05/01/2026;TESTE;-10,00", ""].join("\n");
    const mapping: CsvImportMapping = { delimiter: ";", decimalSeparator: ",", dateFormat: "dd/MM/yyyy", headerRowsToSkip: 1, columns: ["date", "description", "amount"] };

    expect(parseStatementCsv(content, mapping)).toHaveLength(1);
  });

  it("coluna 'ignore' é descartada", () => {
    const content = ["Data;Ref;Descricao;Valor", "05/01/2026;XYZ;TESTE;-10,00"].join("\n");
    const mapping: CsvImportMapping = { delimiter: ";", decimalSeparator: ",", dateFormat: "dd/MM/yyyy", headerRowsToSkip: 1, columns: ["date", "ignore", "description", "amount"] };

    const rows = parseStatementCsv(content, mapping);
    expect(rows[0]).toMatchObject({ description: "TESTE", amountCents: -1000 });
  });
});
