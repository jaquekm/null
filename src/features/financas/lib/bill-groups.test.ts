import { describe, expect, it } from "vitest";
import { billGroupKey, groupBillsByDueDate } from "./bill-groups";

// 2026-09-16 é quarta; a semana (dom-sáb, padrão date-fns) termina em 2026-09-19, o mês em 2026-09-30.
const TODAY = "2026-09-16";

describe("billGroupKey", () => {
  it("antes de hoje: atrasada", () => {
    expect(billGroupKey("2026-09-15", TODAY)).toBe("overdue");
  });

  it("igual a hoje: hoje", () => {
    expect(billGroupKey("2026-09-16", TODAY)).toBe("today");
  });

  it("depois de hoje, dentro da semana: esta semana", () => {
    expect(billGroupKey("2026-09-17", TODAY)).toBe("this_week");
  });

  it("no último dia da semana: ainda esta semana", () => {
    expect(billGroupKey("2026-09-19", TODAY)).toBe("this_week");
  });

  it("logo depois do fim da semana, dentro do mês: este mês", () => {
    expect(billGroupKey("2026-09-20", TODAY)).toBe("this_month");
  });

  it("no último dia do mês: ainda este mês", () => {
    expect(billGroupKey("2026-09-30", TODAY)).toBe("this_month");
  });

  it("no mês seguinte: depois", () => {
    expect(billGroupKey("2026-10-01", TODAY)).toBe("later");
  });
});

describe("groupBillsByDueDate", () => {
  it("separa cada conta no balde certo, mantendo a ordem original dentro de cada balde", () => {
    const bills = [
      { id: "a", dueOn: "2026-10-01" },
      { id: "b", dueOn: "2026-09-15" },
      { id: "c", dueOn: "2026-09-16" },
      { id: "d", dueOn: "2026-09-17" },
      { id: "e", dueOn: "2026-09-25" },
      { id: "f", dueOn: "2026-09-18" },
    ];

    const groups = groupBillsByDueDate(bills, TODAY);

    expect(groups.overdue.map((b) => b.id)).toEqual(["b"]);
    expect(groups.today.map((b) => b.id)).toEqual(["c"]);
    expect(groups.this_week.map((b) => b.id)).toEqual(["d", "f"]);
    expect(groups.this_month.map((b) => b.id)).toEqual(["e"]);
    expect(groups.later.map((b) => b.id)).toEqual(["a"]);
  });

  it("lista vazia: todos os baldes vazios", () => {
    expect(groupBillsByDueDate([], TODAY)).toEqual({ overdue: [], today: [], this_week: [], this_month: [], later: [] });
  });
});
