import { describe, expect, it } from "vitest";
import { detectStatementFormat } from "./detect-statement-format";

describe("detectStatementFormat", () => {
  it("extensão .ofx", () => {
    expect(detectStatementFormat("extrato.ofx", "")).toBe("ofx");
  });

  it("extensão .qfx (variante do Quicken)", () => {
    expect(detectStatementFormat("extrato.qfx", "")).toBe("ofx");
  });

  it("extensão .csv", () => {
    expect(detectStatementFormat("extrato.csv", "")).toBe("csv");
  });

  it("extensão desconhecida, conteúdo com <OFX>: farejado como ofx", () => {
    expect(detectStatementFormat("extrato.dat", "OFXHEADER:100\n<OFX><SIGNONMSGSRSV1>")).toBe("ofx");
  });

  it("extensão desconhecida, conteúdo com <STMTTRN> (sem <OFX> explícito): farejado como ofx", () => {
    expect(detectStatementFormat("extrato.dat", "<STMTTRN><TRNAMT>-10.00</STMTTRN>")).toBe("ofx");
  });

  it("extensão desconhecida, conteúdo de tabela comum: cai pra csv", () => {
    expect(detectStatementFormat("extrato.dat", "data;descricao;valor\n01/01/2026;Mercado;-50,00")).toBe("csv");
  });
});
