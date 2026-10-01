import { describe, expect, it } from "vitest";
import { copyDay, emptyWeekPlan, setPlanCell } from "./menu-plan";

describe("setPlanCell", () => {
  it("preenche uma célula nova", () => {
    const plan = setPlanCell(emptyWeekPlan(), "MO", "almoco", "Frango com arroz");
    expect(plan.MO).toEqual({ almoco: "Frango com arroz" });
  });

  it("não derruba as outras refeições do mesmo dia", () => {
    let plan = setPlanCell(emptyWeekPlan(), "MO", "cafe", "Pão e café");
    plan = setPlanCell(plan, "MO", "almoco", "Frango com arroz");
    expect(plan.MO).toEqual({ cafe: "Pão e café", almoco: "Frango com arroz" });
  });

  it("texto em branco remove a célula em vez de guardar string vazia", () => {
    let plan = setPlanCell(emptyWeekPlan(), "MO", "cafe", "Pão e café");
    plan = setPlanCell(plan, "MO", "cafe", "   ");
    expect(plan.MO).toEqual({});
  });
});

describe("copyDay", () => {
  it("copia o dia de origem pro destino", () => {
    const base = setPlanCell(emptyWeekPlan(), "MO", "almoco", "Frango com arroz");
    const plan = copyDay(base, "MO", "TU");
    expect(plan.TU).toEqual({ almoco: "Frango com arroz" });
    expect(plan.MO).toEqual({ almoco: "Frango com arroz" });
  });

  it("copiar em cima de si mesmo não muda nada", () => {
    const base = setPlanCell(emptyWeekPlan(), "MO", "almoco", "Frango com arroz");
    expect(copyDay(base, "MO", "MO")).toBe(base);
  });

  it("origem vazia limpa o destino", () => {
    const base = setPlanCell(emptyWeekPlan(), "TU", "almoco", "Peixe");
    const plan = copyDay(base, "MO", "TU");
    expect(plan.TU).toEqual({});
  });
});
