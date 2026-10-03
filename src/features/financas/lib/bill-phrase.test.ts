import { describe, expect, it } from "vitest";
import { parseBillPhrase } from "./bill-phrase";

const TZ = "America/Sao_Paulo";
// Sábado, 03/10/2026, 10h em São Paulo.
const NOW = new Date("2026-10-03T13:00:00Z");

describe("parseBillPhrase", () => {
  it("pagar + valor + dia vira conta a pagar com descrição limpa", () => {
    expect(parseBillPhrase("Pagar os pastéis ao clube Leo R$ 60 dia 10", NOW, TZ)).toEqual({
      direction: "payable",
      description: "Pastéis ao clube Leo",
      amountCents: 6000,
      amount: "60,00",
      dueOn: "2026-10-10",
      dueFromPhrase: true,
    });
  });

  it("“me lembra de pagar …” também, com reais por extenso e data relativa", () => {
    const parsed = parseBillPhrase("me lembra de pagar a luz 189,90 reais amanhã", NOW, TZ);
    expect(parsed).toMatchObject({ direction: "payable", description: "Luz", amountCents: 18990, dueOn: "2026-10-04" });
  });

  it("milhar com ponto e “R$” colado", () => {
    expect(parseBillPhrase("aluguel R$1.250,00 dia 5", NOW, TZ)).toMatchObject({ amountCents: 125000, description: "Aluguel", dueOn: "2026-10-05" });
  });

  it("receber/cobrar vira conta a receber", () => {
    expect(parseBillPhrase("cobrar a Ana R$ 45 sexta", NOW, TZ)).toMatchObject({ direction: "receivable", description: "Ana", amountCents: 4500 });
  });

  it("sem data, vence hoje", () => {
    expect(parseBillPhrase("pagar boleto da escola R$ 300", NOW, TZ)).toMatchObject({ dueOn: "2026-10-03", dueFromPhrase: false, description: "Boleto da escola" });
  });

  it("não é conta: sem valor, sem verbo de dinheiro, ou número que é data", () => {
    expect(parseBillPhrase("Pagar os pasteis ao clube leo", NOW, TZ)).toBeNull();
    expect(parseBillPhrase("comprar pão R$ 10", NOW, TZ)).toBeNull();
    expect(parseBillPhrase("me lembra de pagar a luz dia 10", NOW, TZ)).toBeNull();
    expect(parseBillPhrase("", NOW, TZ)).toBeNull();
  });
});
