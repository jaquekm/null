import { describe, expect, it } from "vitest";
import { recurrencePresetForRepeat, recurringDirectionForType } from "./build-recurring-from-transaction";

describe("recurrencePresetForRepeat", () => {
  it("'none': sem recorrência", () => {
    expect(recurrencePresetForRepeat("none", "2026-09-21")).toBeNull();
  });

  it("'weekly': dia da semana do próprio lançamento (2026-09-21 é segunda)", () => {
    expect(recurrencePresetForRepeat("weekly", "2026-09-21")).toEqual({ kind: "weekly", days: ["MO"] });
  });

  it("'weekly': domingo", () => {
    expect(recurrencePresetForRepeat("weekly", "2026-09-20")).toEqual({ kind: "weekly", days: ["SU"] });
  });

  it("'monthly': dia do mês do próprio lançamento", () => {
    expect(recurrencePresetForRepeat("monthly", "2026-09-21")).toEqual({ kind: "monthly_day", day: 21 });
  });

  it("'yearly': sem parâmetro extra", () => {
    expect(recurrencePresetForRepeat("yearly", "2026-09-21")).toEqual({ kind: "yearly" });
  });
});

describe("recurringDirectionForType", () => {
  it("despesa → a pagar", () => {
    expect(recurringDirectionForType("expense")).toBe("payable");
  });

  it("receita → a receber", () => {
    expect(recurringDirectionForType("income")).toBe("receivable");
  });
});
