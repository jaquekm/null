import { describe, expect, it } from "vitest";
import { buildRRuleString, nextOccurrence } from "./recurrence";
import { describeReminderPhrase, isReminderRequest, parseReminderPhrase } from "./parse-reminder-phrase";

const TZ = "America/Sao_Paulo";
// Terça, 29/09/2026, 10:30 em São Paulo.
const NOW = new Date("2026-09-29T13:30:00Z");

function parse(text: string, now = NOW) {
  const parsed = parseReminderPhrase(text, now, TZ);
  if (!parsed) throw new Error(`não entendeu: ${text}`);
  return parsed;
}

describe("parseReminderPhrase — uma vez", () => {
  it.each([
    ["amanhã 9h", "2026-09-30", "09:00"],
    ["amanhã às 14h30", "2026-09-30", "14:30"],
    ["amanha as 8:15", "2026-09-30", "08:15"],
    ["amanhã de manhã", "2026-09-30", "09:00"],
    ["amanhã à tarde", "2026-09-30", "14:00"],
    ["amanhã à noite", "2026-09-30", "20:00"],
    ["amanhã cedo", "2026-09-30", "08:00"],
    ["amanhã ao meio-dia", "2026-09-30", "12:00"],
    ["depois de amanhã às 3 da tarde", "2026-10-01", "15:00"],
    ["hoje às 18h", "2026-09-29", "18:00"],
    ["hoje à noite", "2026-09-29", "20:00"],
    ["às 15h", "2026-09-29", "15:00"],
    ["às 8h", "2026-09-30", "08:00"],
    ["sexta às 14h", "2026-10-02", "14:00"],
    ["na sexta-feira", "2026-10-02", "09:00"],
    ["terça", "2026-10-06", "09:00"],
    ["próxima segunda às 10", "2026-10-05", "10:00"],
    ["quinta da semana que vem", "2026-10-08", "09:00"],
    ["dia 10", "2026-10-10", "09:00"],
    ["dia 30 às 8h", "2026-09-30", "08:00"],
    ["no dia 5 de manhã", "2026-10-05", "09:00"],
    ["15/10 às 16:45", "2026-10-15", "16:45"],
    ["10/01", "2027-01-10", "09:00"],
    ["20/12/2027", "2027-12-20", "09:00"],
    ["25 de dezembro", "2026-12-25", "09:00"],
    ["3 de março às 7h", "2027-03-03", "07:00"],
    ["daqui a 3 dias", "2026-10-02", "09:00"],
    ["em 2 semanas às 11h", "2026-10-13", "11:00"],
    ["semana que vem", "2026-10-06", "09:00"],
    ["mês que vem", "2026-10-29", "09:00"],
    ["amanhã às 9 e meia", "2026-09-30", "09:30"],
    ["amanhã 8 da noite", "2026-09-30", "20:00"],
  ])("%s → %s %s", (text, date, time) => {
    const parsed = parse(text);
    expect(parsed.recurrence).toEqual({ kind: "once" });
    expect([parsed.date, parsed.time]).toEqual([date, time]);
    expect(parsed.isPast).toBe(false);
  });

  it("relativo em minutos e horas conta a partir de agora", () => {
    expect([parse("daqui a 2 horas").date, parse("daqui a 2 horas").time]).toEqual(["2026-09-29", "12:30"]);
    expect(parse("em 30 minutos").time).toBe("11:00");
    expect(parse("em meia hora").time).toBe("11:00");
    expect(parse("daqui a uma hora").time).toBe("11:30");
  });

  it("hoje sem hora, depois das 9h, vira a próxima hora cheia", () => {
    expect(parse("hoje").time).toBe("11:00");
    expect(parse("hoje", new Date("2026-09-29T10:00:00Z")).time).toBe("09:00");
  });

  it("marca quando o horário já passou", () => {
    expect(parse("hoje às 8h").isPast).toBe(true);
  });

  it("sendAt é o instante certo no fuso", () => {
    expect(parse("amanhã 9h").sendAt.toISOString()).toBe("2026-09-30T12:00:00.000Z");
  });
});

describe("parseReminderPhrase — recorrência", () => {
  it("toda segunda", () => {
    const parsed = parse("toda segunda");
    expect(parsed.recurrence).toEqual({ kind: "weekly", days: ["MO"] });
    expect([parsed.date, parsed.time]).toEqual(["2026-10-05", "09:00"]);
  });

  it("toda terça às 11h conta hoje se ainda dá tempo", () => {
    expect(parse("toda terça às 11h").date).toBe("2026-09-29");
    expect(parse("toda terça às 10h").date).toBe("2026-10-06");
  });

  it("vários dias da semana", () => {
    expect(parse("todas as segundas e quartas às 7h").recurrence).toEqual({ kind: "weekly", days: ["MO", "WE"] });
    expect(parse("toda segunda, quarta e sexta").recurrence).toEqual({ kind: "weekly", days: ["MO", "WE", "FR"] });
    expect(parse("todo sábado").recurrence).toEqual({ kind: "weekly", days: ["SA"] });
  });

  it("todo dia / dias úteis", () => {
    expect(parse("todo dia às 8h")).toMatchObject({ recurrence: { kind: "daily" }, date: "2026-09-30", time: "08:00" });
    expect(parse("todos os dias às 22h")).toMatchObject({ recurrence: { kind: "daily" }, date: "2026-09-29" });
    expect(parse("toda noite")).toMatchObject({ recurrence: { kind: "daily" }, time: "20:00" });
    expect(parse("de segunda a sexta às 7h")).toMatchObject({ recurrence: { kind: "weekdays" }, date: "2026-09-30" });
    expect(parse("dias úteis").recurrence).toEqual({ kind: "weekdays" });
  });

  it("mensal pelo dia", () => {
    expect(parse("dia 10 de todo mês")).toMatchObject({ recurrence: { kind: "monthly_day", day: 10 }, date: "2026-10-10" });
    expect(parse("todo dia 5")).toMatchObject({ recurrence: { kind: "monthly_day", day: 5 }, date: "2026-10-05" });
    expect(parse("todo mês no dia 30")).toMatchObject({ recurrence: { kind: "monthly_day", day: 30 }, date: "2026-09-30" });
    expect(parse("todo dia 31")).toMatchObject({ recurrence: { kind: "monthly_day", day: 31 }, date: "2026-09-30" });
    expect(parse("todo mês").recurrence).toEqual({ kind: "monthly_day", day: 29 });
  });

  it("última sexta de cada mês", () => {
    expect(parse("toda última sexta do mês")).toMatchObject({ recurrence: { kind: "monthly_last_weekday", day: "FR" }, date: "2026-10-30" });
    expect(parse("última sexta de cada mês").recurrence).toEqual({ kind: "monthly_last_weekday", day: "FR" });
  });

  it("todo ano", () => {
    expect(parse("todo ano dia 10/03")).toMatchObject({ recurrence: { kind: "yearly" }, date: "2027-03-10" });
    expect(parse("todo ano 25 de dezembro")).toMatchObject({ recurrence: { kind: "yearly" }, date: "2026-12-25" });
  });

  it("toda semana usa o dia de hoje", () => {
    expect(parse("toda semana às 8h")).toMatchObject({ recurrence: { kind: "weekly", days: ["TU"] }, date: "2026-10-06" });
  });

  it("a primeira ocorrência bate com o que o RRULE gera", () => {
    for (const text of ["toda segunda", "dia 10 de todo mês", "de segunda a sexta às 7h", "toda última sexta do mês", "todo dia 31"]) {
      const parsed = parse(text);
      const rrule = buildRRuleString(parsed.recurrence, parsed.sendAt, TZ)!;
      const beforeFirst = new Date(parsed.sendAt.getTime() - 60_000);
      expect(nextOccurrence(rrule, TZ, beforeFirst)?.toISOString(), text).toBe(parsed.sendAt.toISOString());
    }
  });
});

describe("parseReminderPhrase — assunto", () => {
  it.each([
    ["me lembra de ligar pro dentista amanhã às 9h", "ligar pro dentista"],
    ["Me lembra: pagar a conta de luz dia 10 de todo mês", "pagar a conta de luz"],
    ["lembrar de regar as plantas toda segunda", "regar as plantas"],
    ["amanhã 9h Reunião com o João", "Reunião com o João"],
    ["tomar remédio todo dia às 8h", "tomar remédio"],
    ["comprar pão na sexta", "comprar pão"],
    ["pedir a segunda via do boleto amanhã", "pedir a segunda via do boleto"],
    ["amanhã", ""],
  ])("%s → %s", (text, subject) => {
    expect(parse(text).subject).toBe(subject);
  });

  it("não confunde 'segunda via' com segunda-feira", () => {
    expect(parse("pedir a segunda via do boleto amanhã").date).toBe("2026-09-30");
  });
});

describe("parseReminderPhrase — sem data", () => {
  it.each(["", "   ", "ligar pro dentista", "comprar 2 pães", "dia 45"])("%s → null", (text) => {
    expect(parseReminderPhrase(text, NOW, TZ)).toBeNull();
  });
});

describe("describeReminderPhrase", () => {
  it.each([
    ["amanhã 9h", "amanhã às 09:00"],
    ["hoje às 18h", "hoje às 18:00"],
    ["sexta às 14h", "sex 02/10 às 14:00"],
    ["10/01", "dom 10/01/2027 às 09:00"],
    ["toda segunda", "toda segunda às 09:00 (começa seg 05/10)"],
    ["todo sábado às 10h", "todo sábado às 10:00 (começa sáb 03/10)"],
    ["todo dia às 8h", "todo dia às 08:00 (começa amanhã)"],
    ["dias úteis 7h", "de segunda a sexta às 07:00 (começa amanhã)"],
    ["dia 10 de todo mês", "todo dia 10 às 09:00 (começa sáb 10/10)"],
    ["toda última sexta do mês", "na última sexta de cada mês às 09:00 (começa sex 30/10)"],
    ["todo ano dia 10/03", "todo ano em 10/03 às 09:00 (começa qua 10/03/2027)"],
  ])("%s → %s", (text, description) => {
    expect(describeReminderPhrase(parse(text), NOW, TZ)).toBe(description);
  });

  it("vários dias", () => {
    expect(describeReminderPhrase(parse("todas as segundas e quartas às 7h"), NOW, TZ)).toBe("às segundas e quartas às 07:00 (começa amanhã)");
  });
});

describe("isReminderRequest", () => {
  it.each([
    ["me lembra de ligar pro dentista amanhã", true],
    ["Me lembre amanhã", true],
    ["me avisa sexta", true],
    ["lembrar de pagar a luz", true],
    ["Lembrete: consulta dia 10", true],
    ["lembrete amanhã 9h", true],
    ["Lembranças da viagem", false],
    ["ligar pro dentista amanhã", false],
    ["lembrar", false],
  ])("%s → %s", (text, expected) => {
    expect(isReminderRequest(text)).toBe(expected);
  });
});
