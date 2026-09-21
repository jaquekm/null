import { describe, expect, it } from "vitest";
import { parseOfx } from "./ofx";

const SGML_FIXTURE = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<DTSTART>20260101
<DTEND>20260131
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260105120000[-03:EST]
<TRNAMT>-45.90
<FITID>202601050001
<MEMO>PADARIA SILVA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260110120000[-03:EST]
<TRNAMT>1500.00
<FITID>202601100001
<NAME>SALARIO EMPRESA X
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

const XML_FIXTURE =
  '<?xml version="1.0" encoding="UTF-8"?><OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>' +
  "<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260115</DTPOSTED><TRNAMT>-10.50</TRNAMT><FITID>abc123</FITID><MEMO>UBER TRIP</MEMO></STMTTRN>" +
  "</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";

describe("parseOfx", () => {
  it("SGML (OFX 1.x, tags sem fechamento): extrai as transações", () => {
    const rows = parseOfx(SGML_FIXTURE);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ fitid: "202601050001", occurredOn: "2026-01-05", amountCents: -4590, description: "PADARIA SILVA", error: null });
    expect(rows[1]).toEqual({ fitid: "202601100001", occurredOn: "2026-01-10", amountCents: 150000, description: "SALARIO EMPRESA X", error: null });
  });

  it("XML (OFX 2.x, tags fechadas): extrai a transação", () => {
    const rows = parseOfx(XML_FIXTURE);
    expect(rows).toEqual([{ fitid: "abc123", occurredOn: "2026-01-15", amountCents: -1050, description: "UBER TRIP", error: null }]);
  });

  it("prefere MEMO a NAME quando os dois existem", () => {
    const rows = parseOfx("<STMTTRN><DTPOSTED>20260101</DTPOSTED><TRNAMT>-1.00</TRNAMT><NAME>NOME</NAME><MEMO>MEMO</MEMO></STMTTRN>");
    expect(rows[0]?.description).toBe("MEMO");
  });

  it("sem nenhuma <STMTTRN>: lista vazia", () => {
    expect(parseOfx("<OFX><SIGNONMSGSRSV1></SIGNONMSGSRSV1></OFX>")).toEqual([]);
  });

  it("TRNAMT ausente: linha marcada com erro, mas continua na lista (não some)", () => {
    const rows = parseOfx("<STMTTRN>\n<DTPOSTED>20260105\n<FITID>1\n<MEMO>SEM VALOR\n</STMTTRN>");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amountCents).toBeNull();
    expect(rows[0]?.error).toContain("valor inválido");
  });

  it("DTPOSTED ausente: erro de data", () => {
    const rows = parseOfx("<STMTTRN>\n<TRNAMT>-10.00\n<FITID>1\n<MEMO>SEM DATA\n</STMTTRN>");
    expect(rows[0]?.occurredOn).toBeNull();
    expect(rows[0]?.error).toContain("data inválida");
  });

  it("sem FITID: fica null, não é erro (nem todo extrato tem FITID)", () => {
    const rows = parseOfx("<STMTTRN>\n<DTPOSTED>20260105\n<TRNAMT>-10.00\n<MEMO>SEM FITID\n</STMTTRN>");
    expect(rows[0]?.fitid).toBeNull();
    expect(rows[0]?.error).toBeNull();
  });

  it("valor positivo (receita) preserva o sinal", () => {
    const rows = parseOfx("<STMTTRN><DTPOSTED>20260101</DTPOSTED><TRNAMT>+250.00</TRNAMT><MEMO>X</MEMO></STMTTRN>");
    expect(rows[0]?.amountCents).toBe(25000);
  });
});
