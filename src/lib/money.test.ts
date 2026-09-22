import { describe, expect, it } from "vitest";
import { formatBRL, parseBRL, splitByWeights, splitEqual, sumCents } from "./money";

describe("parseBRL", () => {
  it("formato BRL com milhar e centavos: 1.234,56 → 123456", () => {
    expect(parseBRL("1.234,56")).toBe(123456);
  });

  it("vírgula com 1 dígito decimal: 1234,5 → 123450", () => {
    expect(parseBRL("1234,5")).toBe(123450);
  });

  it("prefixo R$ com negativo: R$ -10 → -1000", () => {
    expect(parseBRL("R$ -10")).toBe(-1000);
  });

  it("sinal antes do prefixo: -R$ 10 → -1000", () => {
    expect(parseBRL("-R$ 10")).toBe(-1000);
  });

  it("formato OFX (ponto decimal): 1234.56 → 123456", () => {
    expect(parseBRL("1234.56")).toBe(123456);
  });

  it("só ponto com 3 dígitos: separador de milhar, sem centavos (1.234 → 123400)", () => {
    expect(parseBRL("1.234")).toBe(123400);
  });

  it("vários pontos sem vírgula: todos são separador de milhar (1.234.567 → 123456700)", () => {
    expect(parseBRL("1.234.567")).toBe(123456700);
  });

  it("sem separador nenhum: reais inteiros (1234 → 123400)", () => {
    expect(parseBRL("1234")).toBe(123400);
  });

  it("zero", () => {
    expect(parseBRL("0")).toBe(0);
    expect(parseBRL("0,00")).toBe(0);
  });

  it("espaços em volta são ignorados", () => {
    expect(parseBRL("  1234,56  ")).toBe(123456);
  });

  it("string vazia: lança", () => {
    expect(() => parseBRL("")).toThrow();
    expect(() => parseBRL("   ")).toThrow();
  });

  it("só o prefixo, sem número: lança", () => {
    expect(() => parseBRL("R$")).toThrow();
  });

  it("texto não numérico: lança", () => {
    expect(() => parseBRL("abc")).toThrow();
    expect(() => parseBRL("R$ dez")).toThrow();
  });

  it("vírgula seguida de 3+ dígitos, sem ponto: ambíguo, lança", () => {
    expect(() => parseBRL("1,234")).toThrow();
    expect(() => parseBRL("12,345")).toThrow();
  });

  it("várias vírgulas: ambíguo, lança", () => {
    expect(() => parseBRL("1,234,56")).toThrow();
  });

  it("um só ponto com 4+ dígitos depois: nem decimal nem milhar plausível, lança", () => {
    expect(() => parseBRL("1234.5678")).toThrow();
  });

  it("vírgula sem dígito nenhum depois: lança", () => {
    expect(() => parseBRL("1234,")).toThrow();
  });

  it("número absurdamente grande (estoura Number.isSafeInteger): lança", () => {
    expect(() => parseBRL("99999999999999999999,99")).toThrow();
  });
});

describe("formatBRL", () => {
  it("123456 → R$ 1.234,56", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
  });

  it("negativo: -R$ 1.234,56", () => {
    expect(formatBRL(-123456)).toBe("-R$ 1.234,56");
  });

  it("zero: R$ 0,00", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
  });

  it("sign: true força + em valor positivo", () => {
    expect(formatBRL(5000, { sign: true })).toBe("+R$ 50,00");
  });

  it("sign: true mantém - em valor negativo", () => {
    expect(formatBRL(-5000, { sign: true })).toBe("-R$ 50,00");
  });

  it("sign: true em zero não mostra sinal nenhum", () => {
    expect(formatBRL(0, { sign: true })).toBe("R$ 0,00");
  });
});

describe("sumCents", () => {
  it("lista vazia: 0", () => {
    expect(sumCents([])).toBe(0);
  });

  it("soma positivos e negativos", () => {
    expect(sumCents([100, 200, -50])).toBe(250);
  });
});

describe("splitEqual", () => {
  it("divide igualmente quando dá exato", () => {
    expect(splitEqual(100, 4)).toEqual([25, 25, 25, 25]);
  });

  it("resto vai 1 a 1 pros primeiros", () => {
    const result = splitEqual(100, 3);
    expect(result).toEqual([34, 33, 33]);
    expect(sumCents(result)).toBe(100);
  });

  it("total negativo: resto negativo também vai pros primeiros", () => {
    const result = splitEqual(-100, 3);
    expect(result).toEqual([-34, -33, -33]);
    expect(sumCents(result)).toBe(-100);
  });

  it("n não inteiro ou <= 0: lança", () => {
    expect(() => splitEqual(100, 0)).toThrow();
    expect(() => splitEqual(100, -1)).toThrow();
    expect(() => splitEqual(100, 1.5)).toThrow();
  });

  it("muitos participantes com total ímpar: soma sempre bate exato, resto espalhado 1 a 1", () => {
    const result = splitEqual(100001, 37);
    expect(result).toHaveLength(37);
    expect(sumCents(result)).toBe(100001);
    // 100001 / 37 = 2702,72... → base 2702, resto 27 (100001 - 2702*37 = 27): os 27 primeiros ganham +1.
    expect(result.slice(0, 27)).toEqual(new Array(27).fill(2703));
    expect(result.slice(27)).toEqual(new Array(10).fill(2702));
  });
});

describe("splitByWeights", () => {
  it("pesos iguais se comporta como splitEqual", () => {
    const result = splitByWeights(100, [1, 1, 1]);
    expect(result).toEqual([34, 33, 33]);
    expect(sumCents(result)).toBe(100);
  });

  it("divisão exata por peso (proporção 1:2:3:4)", () => {
    expect(splitByWeights(10, [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  it("maior resto vai pro primeiro em caso de empate", () => {
    const result = splitByWeights(101, [1, 1]);
    expect(result).toEqual([51, 50]);
    expect(sumCents(result)).toBe(101);
  });

  it("total negativo preserva o sinal em todas as partes", () => {
    const result = splitByWeights(-101, [1, 1]);
    expect(result).toEqual([-51, -50]);
    expect(sumCents(result)).toBe(-101);
  });

  it("pesos desproporcionais (70/30)", () => {
    expect(splitByWeights(1000, [70, 30])).toEqual([700, 300]);
  });

  it("soma sempre bate com o total, mesmo com resto grande", () => {
    const result = splitByWeights(1000, [1, 1, 1, 1, 1, 1, 1]);
    expect(sumCents(result)).toBe(1000);
  });

  it("muitos participantes (23) com pesos diferentes e total ímpar: soma sempre bate exato", () => {
    const weights = Array.from({ length: 23 }, (_, i) => i + 1); // 1..23
    const result = splitByWeights(100003, weights);
    expect(result).toHaveLength(23);
    expect(sumCents(result)).toBe(100003);
    expect(result).toEqual([362, 725, 1087, 1449, 1812, 2174, 2536, 2899, 3261, 3623, 3986, 4348, 4710, 5073, 5435, 5797, 6160, 6522, 6884, 7247, 7609, 7971, 8333]);
  });

  it("weights vazio: lança", () => {
    expect(() => splitByWeights(100, [])).toThrow();
  });

  it("peso negativo: lança", () => {
    expect(() => splitByWeights(100, [1, -1])).toThrow();
  });

  it("soma dos pesos zero: lança", () => {
    expect(() => splitByWeights(100, [0, 0])).toThrow();
  });
});
