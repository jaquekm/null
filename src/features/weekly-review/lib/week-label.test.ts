import { describe, expect, it } from "vitest";
import { formatWeekLabel } from "./week-label";

describe("formatWeekLabel", () => {
  it("monta AAAA-Sxx a partir da semana ISO da data", () => {
    // 2026-09-22 é uma terça na semana ISO 39 de 2026.
    expect(formatWeekLabel("2026-09-22")).toBe("2026-S39");
  });

  it("preenche o número da semana com zero à esquerda", () => {
    expect(formatWeekLabel("2026-01-05")).toBe("2026-S02");
  });

  it("semana que cruza o ano novo usa o ano ISO, não o ano do calendário", () => {
    // 2025-12-31 pertence à semana ISO 1 de 2026.
    expect(formatWeekLabel("2025-12-31")).toBe("2026-S01");
  });
});
