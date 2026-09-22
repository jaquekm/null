import { describe, expect, it } from "vitest";
import { buildPixPayload, crc16ccitt, normalizePixKeyValue, normalizePixPhoneKey } from "./pix";

/** Decodificador TLV genérico (ID 2 dígitos + tamanho 2 dígitos + valor) — usado só nos testes, pra não depender de índice de string na mão. Reaproveitável nos subcampos (26/62), que são TLV aninhado. */
function parseTlv(payload: string): Record<string, string> {
  const result: Record<string, string> = {};
  let i = 0;
  while (i < payload.length) {
    const id = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    const value = payload.slice(i + 4, i + 4 + len);
    result[id] = value;
    i += 4 + len;
  }
  return result;
}

describe("crc16ccitt", () => {
  it("bate com o valor de referência conhecido do CRC-16/CCITT-FALSE ('123456789' -> 0x29B1)", () => {
    expect(crc16ccitt("123456789")).toBe("29B1");
  });

  it("sempre devolve 4 dígitos hexadecimais maiúsculos", () => {
    expect(crc16ccitt("")).toMatch(/^[0-9A-F]{4}$/);
    expect(crc16ccitt("abc")).toMatch(/^[0-9A-F]{4}$/);
  });
});

describe("normalizePixPhoneKey", () => {
  it("formata como +55DDDNUMERO a partir de vários formatos de entrada", () => {
    expect(normalizePixPhoneKey("(49) 99988-7766")).toBe("+5549999887766");
    expect(normalizePixPhoneKey("49999887766")).toBe("+5549999887766");
    expect(normalizePixPhoneKey("+55 49 99988-7766")).toBe("+5549999887766");
    expect(normalizePixPhoneKey("5549999887766")).toBe("+5549999887766");
  });
});

describe("normalizePixKeyValue", () => {
  it("cpf/cnpj: só dígitos", () => {
    expect(normalizePixKeyValue("cpf", "123.456.789-00")).toBe("12345678900");
    expect(normalizePixKeyValue("cnpj", "12.345.678/0001-90")).toBe("12345678000190");
  });

  it("email/random: minúsculo e sem espaços nas pontas", () => {
    expect(normalizePixKeyValue("email", "  Fulano@Exemplo.COM ")).toBe("fulano@exemplo.com");
    expect(normalizePixKeyValue("random", " ABC-123 ")).toBe("abc-123");
  });

  it("phone: delega pra normalizePixPhoneKey", () => {
    expect(normalizePixKeyValue("phone", "(49) 99988-7766")).toBe("+5549999887766");
  });
});

describe("buildPixPayload", () => {
  const base = { key: "fulano@exemplo.com", merchantName: "Fulano de Tal", merchantCity: "Sao Paulo" };

  it("monta os campos fixos (payload format, MCC, moeda, país) e termina com CRC de 4 hex", () => {
    const fields = parseTlv(buildPixPayload(base));
    expect(fields["00"]).toBe("01");
    expect(fields["52"]).toBe("0000");
    expect(fields["53"]).toBe("986");
    expect(fields["58"]).toBe("BR");
    expect(fields["63"]).toMatch(/^[0-9A-F]{4}$/);
  });

  it("o CRC final (campo 63) é exatamente o crc16ccitt do restante do payload, incluindo o prefixo 6304", () => {
    const payload = buildPixPayload(base);
    const withoutCrc = payload.slice(0, -4);
    expect(withoutCrc.endsWith("6304")).toBe(true);
    expect(crc16ccitt(withoutCrc)).toBe(payload.slice(-4));
  });

  it("campo 26: GUI fixo + chave Pix nos subcampos 00/01", () => {
    const fields = parseTlv(buildPixPayload(base));
    const accountInfo = parseTlv(fields["26"]!);
    expect(accountInfo["00"]).toBe("br.gov.bcb.pix");
    expect(accountInfo["01"]).toBe("fulano@exemplo.com");
    expect(accountInfo["02"]).toBeUndefined();
  });

  it("campo 26 inclui a descrição (subcampo 02), sem acento, quando informada", () => {
    const fields = parseTlv(buildPixPayload({ ...base, description: "Conta de luz — apê" }));
    const accountInfo = parseTlv(fields["26"]!);
    expect(accountInfo["02"]).toBe("Conta de luz — ape");
  });

  it("inclui o valor (campo 54) formatado com ponto decimal quando amountCents é informado", () => {
    const fields = parseTlv(buildPixPayload({ ...base, amountCents: 8550 }));
    expect(fields["54"]).toBe("85.50");
  });

  it("omite o campo 54 quando não há amountCents, ou quando é 0/negativo (valor livre)", () => {
    expect(parseTlv(buildPixPayload(base))["54"]).toBeUndefined();
    expect(parseTlv(buildPixPayload({ ...base, amountCents: 0 }))["54"]).toBeUndefined();
    expect(parseTlv(buildPixPayload({ ...base, amountCents: -100 }))["54"]).toBeUndefined();
  });

  it("usa '***' no txid (subcampo 05 do campo 62) quando não informado", () => {
    const fields = parseTlv(buildPixPayload(base));
    expect(parseTlv(fields["62"]!)["05"]).toBe("***");
  });

  it("usa o txid informado, só alfanumérico e cortado em 25 caracteres", () => {
    const fields = parseTlv(buildPixPayload({ ...base, txid: "abc-123_XYZ!! " + "x".repeat(20) }));
    const txid = parseTlv(fields["62"]!)["05"]!;
    expect(txid).toBe(("abc123XYZ" + "x".repeat(20)).slice(0, 25));
    expect(txid).toHaveLength(25);
  });

  it("nome e cidade do recebedor saem em maiúsculas, sem acento e cortados no limite do padrão (25/15)", () => {
    const fields = parseTlv(
      buildPixPayload({ ...base, merchantName: "João da Silva Sauro Comprido Demais", merchantCity: "São Paulo Grande" }),
    );
    expect(fields["59"]).toBe("JOAO DA SILVA SAURO COMPR");
    expect(fields["59"]).toHaveLength(25);
    expect(fields["60"]).toBe("SAO PAULO GRAND");
    expect(fields["60"]).toHaveLength(15);
  });

  it("lança erro se a chave deixar o campo 26 acima de 99 caracteres", () => {
    expect(() => buildPixPayload({ ...base, key: "x".repeat(90) })).toThrow();
  });

  it("lança erro com chave vazia", () => {
    expect(() => buildPixPayload({ ...base, key: "   " })).toThrow();
  });
});
