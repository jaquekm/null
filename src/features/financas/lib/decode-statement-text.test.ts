import { describe, expect, it } from "vitest";
import { decodeStatementText } from "./decode-statement-text";

describe("decodeStatementText", () => {
  it("UTF-8 válido: decodifica normalmente", () => {
    const bytes = new TextEncoder().encode("Pão de Açúcar — R$ 45,90");
    expect(decodeStatementText(bytes)).toBe("Pão de Açúcar — R$ 45,90");
  });

  it("ASCII puro: sem acento, caminho feliz", () => {
    const bytes = new TextEncoder().encode("PADARIA SILVA");
    expect(decodeStatementText(bytes)).toBe("PADARIA SILVA");
  });

  it("Windows-1252/Latin1 (bytes inválidos em UTF-8): cai pro fallback", () => {
    // "café" em Windows-1252/Latin1: c,a,f = ASCII; é = 0xE9 (inválido como UTF-8 sozinho).
    const bytes = new Uint8Array([0x63, 0x61, 0x66, 0xe9]);
    expect(decodeStatementText(bytes)).toBe("café");
  });

  it("Windows-1252: 'São Paulo' com ã (0xE3) sozinho, sem continuação UTF-8 válida", () => {
    // "S", 0xE3 ('ã' em Latin1/Windows-1252), "o Paulo" — 0xE3 sozinho não fecha uma sequência UTF-8 válida.
    const bytes = new Uint8Array([0x53, 0xe3, 0x6f, 0x20, 0x50, 0x61, 0x75, 0x6c, 0x6f]);
    expect(decodeStatementText(bytes)).toBe("São Paulo");
  });
});
