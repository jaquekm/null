import { describe, expect, it } from "vitest";
import { computeOccurrenceIndexes, importHash } from "./import-hash";

describe("importHash", () => {
  it("com FITID: ignora data/valor/descrição — dois FITIDs iguais dão o mesmo hash", () => {
    const a = importHash({ accountId: "acc-1", fitid: "F1", occurredOn: "2026-01-05", amountCents: -1000, description: "X", occurrenceIndex: 0 });
    const b = importHash({ accountId: "acc-1", fitid: "F1", occurredOn: "2026-02-01", amountCents: -9999, description: "Y", occurrenceIndex: 3 });
    expect(a).toBe(b);
  });

  it("FITID diferente (mesma conta): hash diferente", () => {
    const a = importHash({ accountId: "acc-1", fitid: "F1", occurredOn: "2026-01-05", amountCents: -1000, description: "X", occurrenceIndex: 0 });
    const b = importHash({ accountId: "acc-1", fitid: "F2", occurredOn: "2026-01-05", amountCents: -1000, description: "X", occurrenceIndex: 0 });
    expect(a).not.toBe(b);
  });

  it("mesmo FITID em contas diferentes: hash diferente (não faz sentido dedup entre contas)", () => {
    const a = importHash({ accountId: "acc-1", fitid: "F1", occurredOn: "2026-01-05", amountCents: -1000, description: "X", occurrenceIndex: 0 });
    const b = importHash({ accountId: "acc-2", fitid: "F1", occurredOn: "2026-01-05", amountCents: -1000, description: "X", occurrenceIndex: 0 });
    expect(a).not.toBe(b);
  });

  it("sem FITID: mesma data/valor/descrição normalizada/ordem dão o mesmo hash", () => {
    const a = importHash({ accountId: "acc-1", fitid: null, occurredOn: "2026-01-05", amountCents: -1000, description: "Padaria Silva", occurrenceIndex: 0 });
    const b = importHash({ accountId: "acc-1", fitid: null, occurredOn: "2026-01-05", amountCents: -1000, description: "PADARIA SILVA", occurrenceIndex: 0 });
    expect(a).toBe(b);
  });

  it("sem FITID: ordem diferente dá hash diferente (desempate)", () => {
    const a = importHash({ accountId: "acc-1", fitid: null, occurredOn: "2026-01-05", amountCents: -1000, description: "Café", occurrenceIndex: 0 });
    const b = importHash({ accountId: "acc-1", fitid: null, occurredOn: "2026-01-05", amountCents: -1000, description: "Café", occurrenceIndex: 1 });
    expect(a).not.toBe(b);
  });

  it("sem FITID: valor diferente dá hash diferente", () => {
    const a = importHash({ accountId: "acc-1", fitid: null, occurredOn: "2026-01-05", amountCents: -1000, description: "X", occurrenceIndex: 0 });
    const b = importHash({ accountId: "acc-1", fitid: null, occurredOn: "2026-01-05", amountCents: -1001, description: "X", occurrenceIndex: 0 });
    expect(a).not.toBe(b);
  });

  it("é determinístico (mesma entrada → mesmo hash sempre)", () => {
    const input = { accountId: "acc-1", fitid: "F9", occurredOn: "2026-01-05", amountCents: -1000, description: "X", occurrenceIndex: 0 };
    expect(importHash(input)).toBe(importHash({ ...input }));
  });
});

describe("computeOccurrenceIndexes", () => {
  it("linhas únicas: todas índice 0", () => {
    const rows = [
      { occurredOn: "2026-01-05", amountCents: -1000, description: "A" },
      { occurredOn: "2026-01-06", amountCents: -2000, description: "B" },
    ];
    expect(computeOccurrenceIndexes(rows)).toEqual([0, 0]);
  });

  it("duas linhas idênticas no mesmo dia: 0 e 1, na ordem em que aparecem", () => {
    const rows = [
      { occurredOn: "2026-01-05", amountCents: -800, description: "Café" },
      { occurredOn: "2026-01-05", amountCents: -800, description: "Café" },
      { occurredOn: "2026-01-05", amountCents: -800, description: "Café" },
    ];
    expect(computeOccurrenceIndexes(rows)).toEqual([0, 1, 2]);
  });

  it("descrição normalizada igual (acentos/caixa) conta como a mesma chave", () => {
    const rows = [
      { occurredOn: "2026-01-05", amountCents: -800, description: "Café" },
      { occurredOn: "2026-01-05", amountCents: -800, description: "CAFE" },
    ];
    expect(computeOccurrenceIndexes(rows)).toEqual([0, 1]);
  });

  it("valor diferente: contadores independentes", () => {
    const rows = [
      { occurredOn: "2026-01-05", amountCents: -800, description: "Café" },
      { occurredOn: "2026-01-05", amountCents: -900, description: "Café" },
    ];
    expect(computeOccurrenceIndexes(rows)).toEqual([0, 0]);
  });
});
