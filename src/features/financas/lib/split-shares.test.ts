import { describe, expect, it } from "vitest";
import { computeSplitShares } from "./split-shares";

describe("computeSplitShares", () => {
  it("sem participantes: lança erro", () => {
    expect(() => computeSplitShares("equal", 10000, [])).toThrow("participante");
  });

  describe("equal", () => {
    it("divide igualmente, resto vai 1 a 1 pros primeiros", () => {
      const result = computeSplitShares("equal", 10000, [{ contactId: null }, { contactId: "a" }, { contactId: "b" }]);
      expect(result.map((r) => r.shareCents)).toEqual([3334, 3333, 3333]);
      expect(result.map((r) => r.weight)).toEqual([null, null, null]);
    });

    it("divide exatamente quando bate certinho", () => {
      const result = computeSplitShares("equal", 10000, [{ contactId: null }, { contactId: "a" }]);
      expect(result.map((r) => r.shareCents)).toEqual([5000, 5000]);
    });
  });

  describe("exact", () => {
    it("soma bate com o total: aceita os valores informados", () => {
      const result = computeSplitShares("exact", 10000, [
        { contactId: null, value: "40,00" },
        { contactId: "a", value: "60,00" },
      ]);
      expect(result.map((r) => r.shareCents)).toEqual([4000, 6000]);
    });

    it("soma não bate: lança erro com os dois valores", () => {
      expect(() =>
        computeSplitShares("exact", 10000, [
          { contactId: null, value: "40,00" },
          { contactId: "a", value: "50,00" },
        ]),
      ).toThrow(/R\$ 90,00.*R\$ 100,00/);
    });

    it("participante sem valor: lança erro", () => {
      expect(() => computeSplitShares("exact", 10000, [{ contactId: null }])).toThrow("Digite o valor");
    });
  });

  describe("percent", () => {
    it("soma 100%: distribui pelo peso", () => {
      const result = computeSplitShares("percent", 10000, [
        { contactId: null, weight: 60 },
        { contactId: "a", weight: 40 },
      ]);
      expect(result.map((r) => r.shareCents)).toEqual([6000, 4000]);
      expect(result.map((r) => r.weight)).toEqual([60, 40]);
    });

    it("soma com pequena imprecisão de ponto flutuante (tolerância 0,01): aceita", () => {
      const result = computeSplitShares("percent", 300, [
        { contactId: null, weight: 33.33 },
        { contactId: "a", weight: 33.33 },
        { contactId: "b", weight: 33.34 },
      ]);
      expect(result.reduce((sum, r) => sum + r.shareCents, 0)).toBe(300);
    });

    it("soma diferente de 100%: lança erro", () => {
      expect(() =>
        computeSplitShares("percent", 10000, [
          { contactId: null, weight: 60 },
          { contactId: "a", weight: 30 },
        ]),
      ).toThrow("100%");
    });

    it("peso zero: lança erro", () => {
      expect(() =>
        computeSplitShares("percent", 10000, [
          { contactId: null, weight: 100 },
          { contactId: "a", weight: 0 },
        ]),
      ).toThrow("peso maior que zero");
    });
  });

  describe("shares (cotas)", () => {
    it("distribui proporcionalmente às cotas, sem exigir soma específica", () => {
      // 2 adultos, 1 criança: cotas 2/2/1 de um total de 10000
      const result = computeSplitShares("shares", 10000, [
        { contactId: null, weight: 2 },
        { contactId: "a", weight: 2 },
        { contactId: "b", weight: 1 },
      ]);
      expect(result.map((r) => r.shareCents)).toEqual([4000, 4000, 2000]);
    });

    it("peso ausente (undefined): tratado como zero, lança erro", () => {
      expect(() => computeSplitShares("shares", 10000, [{ contactId: null, weight: 2 }, { contactId: "a" }])).toThrow("peso maior que zero");
    });
  });
});
