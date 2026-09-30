import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { RecurrencePreset, Weekday } from "./recurrence";

/**
 * "Me lembra…" em linguagem de uso (9.4): lê o *quando* de uma frase em
 * português ("amanhã 9h", "sexta às 14h", "toda segunda", "dia 10 de todo
 * mês", "daqui a 2 horas") e devolve data/hora locais + recorrência no mesmo
 * formato do formulário de lembrete (`RecurrencePreset`). O que sobra da
 * frase vira o assunto ("ligar pro dentista"). Puro: o relógio e o fuso vêm
 * de fora, pra testar e pra rodar igual no navegador (prévia) e no servidor.
 */
export interface ParsedReminderPhrase {
  /** Data local da primeira ocorrência (yyyy-MM-dd). */
  date: string;
  /** Hora local (HH:mm). */
  time: string;
  recurrence: RecurrencePreset;
  /** A frase sem a parte do "quando" (pode ser vazia). */
  subject: string;
  /** Instante real da primeira ocorrência. */
  sendAt: Date;
  /** Só pra "uma vez": o horário já passou (ex.: "hoje 8h" às 10h). */
  isPast: boolean;
}

const WEEKDAY_CODES: Weekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const WEEKDAY_BY_NAME: Record<string, Weekday> = {
  domingo: "SU",
  segunda: "MO",
  terca: "TU",
  quarta: "WE",
  quinta: "TH",
  sexta: "FR",
  sabado: "SA",
};
const MONTH_BY_PREFIX: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};
const NUMBER_WORDS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  quinze: 15,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
};
const PERIOD_TIME: Record<string, string> = { manha: "09:00", tarde: "14:00", noite: "20:00", cedo: "08:00" };
const DEFAULT_TIME = "09:00";

// "segunda", "segundas", "segunda-feira" — mas não "segunda via".
const WD = "(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)s?(?:[- ]feiras?)?(?!\\s+via\\b)";
const MONTH = "(jan(?:eiro)?|fev(?:ereiro)?|mar(?:co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)";
const NUM = `(\\d{1,3}|meia|${Object.keys(NUMBER_WORDS).join("|")})`;
const PERIOD = "(?:\\s+(?:da|de)\\s+(manha|tarde|noite|madrugada))?";

/** Minúsculas e sem acento, **com o mesmo tamanho** do original — os índices dos trechos achados servem pros dois. */
function normalize(text: string): string {
  return Array.from(text, (ch) => {
    const base = ch.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return base.length === ch.length ? base : ch.toLowerCase().length === ch.length ? ch.toLowerCase() : ch;
  }).join("");
}

class Scanner {
  norm: string;
  readonly removed: boolean[];
  constructor(text: string) {
    this.norm = normalize(text);
    this.removed = new Array<boolean>(this.norm.length).fill(false);
  }
  /** Acha o padrão, apaga o trecho (pra ninguém mais casar com ele) e devolve os grupos. */
  take(pattern: string): RegExpExecArray | null {
    const match = new RegExp(pattern).exec(this.norm);
    if (!match) return null;
    const end = match.index + match[0].length;
    this.norm = this.norm.slice(0, match.index) + " ".repeat(match[0].length) + this.norm.slice(end);
    for (let i = match.index; i < end; i += 1) this.removed[i] = true;
    return match;
  }
}

// ---------- calendário (datas locais como yyyy-MM-dd, contas em UTC puro) ----------

function toUtc(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}
function fromUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}
function addDays(date: string, days: number): string {
  const value = toUtc(date);
  value.setUTCDate(value.getUTCDate() + days);
  return fromUtc(value);
}
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function makeDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function weekdayOf(date: string): Weekday {
  return WEEKDAY_CODES[toUtc(date).getUTCDay()]!;
}
function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y!, m!, d!];
}
function addMonths(date: string, months: number): string {
  const [y, m, d] = parts(date);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return makeDate(year, month, Math.min(d, daysInMonth(year, month)));
}
function lastWeekdayOfMonth(year: number, month: number, weekday: Weekday): string {
  let date = makeDate(year, month, daysInMonth(year, month));
  while (weekdayOf(date) !== weekday) date = addDays(date, -1);
  return date;
}

function weekdayFromWord(word: string): Weekday | null {
  const key = Object.keys(WEEKDAY_BY_NAME).find((name) => word.startsWith(name));
  return key ? WEEKDAY_BY_NAME[key]! : null;
}
function numberFrom(word: string): number {
  if (word === "meia") return 0.5;
  return /^\d+$/.test(word) ? Number(word) : (NUMBER_WORDS[word] ?? NaN);
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function withPeriod(hour: number, period: string | undefined): number {
  if ((period === "tarde" || period === "noite") && hour < 12) return hour + 12;
  if (period === "noite" && hour === 12) return 0;
  if ((period === "manha" || period === "madrugada") && hour === 12) return 0;
  return hour;
}

type ExplicitTime = { hour: number; minute: number };

function readTime(scan: Scanner): { time: ExplicitTime | null; period: string | null } {
  const valid = (hour: number, minute: number): ExplicitTime | null => (hour <= 23 && minute <= 59 ? { hour, minute } : null);

  const noon = scan.take("\\b(?:(?:ao|as|a)\\s+)?meio[- ]dia(\\s+e\\s+meia)?\\b");
  if (noon) return { time: { hour: 12, minute: noon[1] ? 30 : 0 }, period: null };
  const midnight = scan.take("\\b(?:a\\s+)?meia[- ]noite\\b");
  if (midnight) return { time: { hour: 0, minute: 0 }, period: null };

  // 9h, 9h30, 9:30, 9 horas, "às 14h da tarde"
  const clock = scan.take(`(?:\\b(?:as|a|pelas|por\\s+volta\\s+das)\\s+)?\\b(\\d{1,2})(?::(\\d{2})|\\s*h(?:oras?|rs?|s)?(?:\\s*(\\d{2}))?)(?:\\s+e\\s+(meia))?${PERIOD}(?![\\w/])`);
  if (clock) {
    const minute = clock[2] ?? clock[3];
    const time = valid(withPeriod(Number(clock[1]), clock[5]), clock[4] ? 30 : Number(minute ?? 0));
    if (time) return { time, period: null };
  }
  // "às 9", "às 3 da tarde", "às 9 e meia"
  const loose = scan.take(`\\b(?:as|pelas)\\s+(\\d{1,2})(?:\\s+e\\s+(meia))?${PERIOD}\\b(?![/:])`);
  if (loose) {
    const time = valid(withPeriod(Number(loose[1]), loose[3]), loose[2] ? 30 : 0);
    if (time) return { time, period: null };
  }
  // "3 da tarde", "8 e meia da manhã"
  const spoken = scan.take("(?<!\\bdia\\s{1,3})\\b(\\d{1,2})(?:\\s+e\\s+(meia))?\\s+(?:da|de)\\s+(manha|tarde|noite|madrugada)\\b");
  if (spoken) {
    const time = valid(withPeriod(Number(spoken[1]), spoken[3]), spoken[2] ? 30 : 0);
    if (time) return { time, period: null };
  }
  const period = scan.take("\\b(?:(?:de|pela|na|a|durante\\s+a)\\s+(manha|tarde|noite)|(cedo)|(?:toda|todas\\s+as)\\s+(manha|tarde|noite)s?)\\b");
  if (period) return { time: null, period: period[1] ?? period[2] ?? period[3]! };
  return { time: null, period: null };
}

type Recurrence =
  | { kind: "daily" }
  | { kind: "weekdays" }
  | { kind: "weekly"; days: Weekday[] | null }
  | { kind: "monthly_day"; day: number | null }
  | { kind: "monthly_last_weekday"; day: Weekday }
  | { kind: "yearly" };

function readRecurrence(scan: Scanner): Recurrence | null {
  const lastWeekday =
    scan.take(`\\b(?:toda|todo)\\s+(?:a\\s+)?ultim[oa]\\s+(${WD})(?:\\s+(?:do|de\\s+cada|de\\s+todo)\\s+mes)?\\b`) ??
    scan.take(`\\b(?:na\\s+)?ultim[oa]\\s+(${WD})\\s+(?:de\\s+cada|de\\s+todo)\\s+mes\\b`);
  if (lastWeekday) return { kind: "monthly_last_weekday", day: weekdayFromWord(lastWeekday[1]!)! };

  if (scan.take("\\b(?:todos?\\s+(?:os\\s+)?dias?\\s+uteis|(?:nos\\s+|em\\s+)?dias\\s+uteis|(?:toda\\s+)?(?:de\\s+)?segunda\\s+a\\s+sexta(?:[- ]feira)?)\\b")) {
    return { kind: "weekdays" };
  }

  const weekly = scan.take(`\\b(?:toda|todo|todas|todos)\\s+(?:as\\s+|os\\s+)?(${WD}(?:\\s*(?:,|e)\\s*(?:(?:a|as|o|os)\\s+)?${WD})*)`);
  if (weekly) {
    const days = [...weekly[1]!.matchAll(/(segunda|terca|quarta|quinta|sexta|sabado|domingo)/g)].map((m) => WEEKDAY_BY_NAME[m[1]!]!);
    return { kind: "weekly", days: [...new Set(days)] };
  }

  const monthlyDay =
    scan.take("\\b(?:todo|todos\\s+os)\\s+dias?\\s+(\\d{1,2})[ºo°]?(?:\\s+de\\s+(?:todo|cada)\\s+mes)?\\b") ??
    scan.take("\\b(?:no\\s+)?dia\\s+(\\d{1,2})[ºo°]?\\s+de\\s+(?:todo|cada)\\s+mes\\b") ??
    scan.take("\\b(?:todo\\s+mes|todos\\s+os\\s+meses|mensalmente)\\s*,?\\s+(?:no\\s+)?dia\\s+(\\d{1,2})[ºo°]?\\b");
  if (monthlyDay) {
    const day = Number(monthlyDay[1]);
    if (day >= 1 && day <= 31) return { kind: "monthly_day", day };
  }

  if (scan.take("\\b(?:todo\\s+dia|todos\\s+os\\s+dias|diariamente)\\b")) return { kind: "daily" };
  if (scan.take("\\b(?:toda\\s+semana|todas\\s+as\\s+semanas|semanalmente|uma\\s+vez\\s+por\\s+semana)\\b")) return { kind: "weekly", days: null };
  if (scan.take("\\b(?:todo\\s+mes|todos\\s+os\\s+meses|mensalmente|uma\\s+vez\\s+por\\s+mes)\\b")) return { kind: "monthly_day", day: null };
  if (scan.take("\\b(?:todo\\s+ano|todos\\s+os\\s+anos|anualmente|uma\\s+vez\\s+por\\s+ano)\\b")) return { kind: "yearly" };
  // "toda manhã/noite" = todo dia (o período já vira a hora em `readTime`).
  if (/\b(?:toda|todas\s+as)\s+(?:manha|tarde|noite)s?\b/.test(scan.norm)) return { kind: "daily" };
  return null;
}

type Relative = { minutes: number } | { days: number } | { months: number };

function readRelative(scan: Scanner): Relative | null {
  const match = scan.take(`\\b(?:em|daqui\\s+a|daqui|dentro\\s+de)\\s+${NUM}\\s+(minutos?|mins?|horas?|h|dias?|semanas?|mes(?:es)?)\\b`);
  if (!match) {
    if (scan.take("\\b(?:em|daqui\\s+a|daqui|dentro\\s+de)\\s+meia\\s+hora\\b")) return { minutes: 30 };
    return null;
  }
  const amount = numberFrom(match[1]!);
  const unit = match[2]!;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit.startsWith("min")) return { minutes: Math.round(amount) };
  if (unit.startsWith("h")) return { minutes: Math.round(amount * 60) };
  if (unit.startsWith("dia")) return { days: Math.round(amount) };
  if (unit.startsWith("semana")) return { days: Math.round(amount * 7) };
  return { months: Math.round(amount) };
}

/** A data dita (uma vez) — `null` se a frase não fala de dia. */
function readDate(scan: Scanner, today: string): { date: string; explicitYear?: boolean } | null {
  scan.take("\\ba\\s+partir\\s+(?:de|do|da)(?=\\s)");
  if (scan.take("\\bdepois\\s+de\\s+amanha\\b")) return { date: addDays(today, 2) };
  if (scan.take("\\bamanha\\b")) return { date: addDays(today, 1) };
  if (scan.take("\\b(?:hoje|hj)\\b")) return { date: today };

  const weekday = scan.take(
    `\\b(?:(?:na|no|nesta|neste|nessa|nesse|esta|este|essa|esse|proxim[oa]|na\\s+proxima|no\\s+proximo)\\s+)?(${WD})(\\s+(?:que\\s+vem|da\\s+(?:semana\\s+que\\s+vem|proxima\\s+semana)))?\\b`,
  );
  if (weekday) {
    const target = weekdayFromWord(weekday[1]!)!;
    if (weekday[2]?.includes("semana")) {
      // "sexta da semana que vem": a sexta da próxima semana (segunda a domingo).
      let monday = addDays(today, 1);
      while (weekdayOf(monday) !== "MO") monday = addDays(monday, 1);
      let date = monday;
      while (weekdayOf(date) !== target) date = addDays(date, 1);
      return { date };
    }
    let date = addDays(today, 1);
    while (weekdayOf(date) !== target) date = addDays(date, 1);
    return { date };
  }

  const [ty, tm, td] = parts(today);
  const withYear = (year: number | undefined, month: number, day: number): { date: string; explicitYear?: boolean } | null => {
    if (month < 1 || month > 12) return null;
    if (year !== undefined) {
      if (day < 1 || day > daysInMonth(year, month)) return null;
      return { date: makeDate(year, month, day), explicitYear: true };
    }
    if (day < 1 || day > 31) return null;
    // Sem ano: a próxima vez que essa data acontece (hoje conta).
    for (let y = ty; y <= ty + 4; y += 1) {
      if (day > daysInMonth(y, month)) continue;
      const date = makeDate(y, month, day);
      if (date >= today) return { date };
    }
    return null;
  };
  const fullYear = (raw: string | undefined) => (raw === undefined ? undefined : raw.length === 2 ? 2000 + Number(raw) : Number(raw));

  const slash = scan.take("\\b(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{4}|\\d{2}))?\\b");
  if (slash) return withYear(fullYear(slash[3]), Number(slash[2]), Number(slash[1]));

  const named = scan.take(`\\b(?:(?:no\\s+)?dia\\s+)?(\\d{1,2})[ºo°]?\\s+de\\s+${MONTH}(?:\\s+de\\s+(\\d{4}))?\\b`);
  if (named) return withYear(fullYear(named[3]), MONTH_BY_PREFIX[named[2]!.slice(0, 3)]!, Number(named[1]));

  const dayOnly = scan.take("\\b(?:no\\s+)?dia\\s+(\\d{1,2})[ºo°]?\\b");
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    if (day < 1 || day > 31) return null;
    // "dia 10": este mês se ainda não passou, senão o próximo mês que tenha esse dia.
    for (let offset = 0; offset < 12; offset += 1) {
      const total = ty * 12 + (tm - 1) + offset;
      const year = Math.floor(total / 12);
      const month = (total % 12) + 1;
      if (day > daysInMonth(year, month)) continue;
      if (offset === 0 && day < td) continue;
      return { date: makeDate(year, month, day) };
    }
    return null;
  }

  if (scan.take("\\b(?:(?:na\\s+)?semana\\s+que\\s+vem|(?:na\\s+)?proxima\\s+semana)\\b")) return { date: addDays(today, 7) };
  if (scan.take("\\b(?:(?:no\\s+)?mes\\s+que\\s+vem|(?:no\\s+)?proximo\\s+mes)\\b")) return { date: addMonths(today, 1) };
  if (scan.take("\\b(?:(?:no\\s+)?ano\\s+que\\s+vem|(?:no\\s+)?proximo\\s+ano)\\b")) return { date: addMonths(today, 12) };
  return null;
}

/** O que sobra da frase, sem "me lembra de", conectivos soltos e pontuação nas pontas. */
function extractSubject(original: string, removed: boolean[]): string {
  let subject = original
    .split("")
    .map((unit, i) => (removed[i] ? " " : unit))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  const lead = /^(?:(?:(?:me\s+)?lembr(?:ar|ete|a|e)|me\s+avis(?:ar|a|e))(?:\s*[:,-])?(?:\s+(?:me|de|do|da|que|pra|para|sobre))*|(?:de|do|da|que|pra|para|,|-|:|e)(?=\s|$))\s*/;
  const trail = /\s*(?:\b(?:de|do|da|no|na|as|a|e|em|pra|para|que)|[,:;-])$/;
  for (let i = 0; i < 6; i += 1) {
    const before = subject;
    const leadMatch = lead.exec(normalize(subject));
    if (leadMatch && leadMatch[0].length > 0) subject = subject.slice(leadMatch[0].length);
    const trailMatch = trail.exec(normalize(subject));
    if (trailMatch && trailMatch[0].length > 0) subject = subject.slice(0, subject.length - trailMatch[0].length);
    subject = subject.trim();
    if (subject === before) break;
  }
  return subject;
}

function nextHourTime(nowTime: string): string | null {
  const hour = Number(nowTime.slice(0, 2)) + 1;
  return hour <= 23 ? `${pad(hour)}:00` : null;
}

/** Primeira data ≥ `start` que casa com a recorrência e ainda não passou (hoje só conta se a hora está à frente). */
function firstOccurrence(rec: RecurrencePreset, start: string, time: string, today: string, nowTime: string): string {
  const fits = (date: string) => date > today || (date === today && time > nowTime);
  let date = start < today ? today : start;
  for (let i = 0; i < 800; i += 1) {
    const [y, m, d] = parts(date);
    let matches = false;
    switch (rec.kind) {
      case "daily":
        matches = true;
        break;
      case "weekdays":
        matches = !["SA", "SU"].includes(weekdayOf(date));
        break;
      case "weekly":
        matches = rec.days.includes(weekdayOf(date));
        break;
      case "monthly_day":
        matches = d === Math.min(rec.day, daysInMonth(y, m));
        break;
      case "monthly_last_weekday":
        matches = date === lastWeekdayOfMonth(y, m, rec.day);
        break;
      case "yearly": {
        const [, sm, sd] = parts(start);
        matches = m === sm && d === Math.min(sd, daysInMonth(y, m));
        break;
      }
      default:
        matches = true;
    }
    if (matches && fits(date)) return date;
    date = addDays(date, 1);
  }
  return date;
}

export function parseReminderPhrase(text: string, now: Date, timezone: string): ParsedReminderPhrase | null {
  if (!text.trim()) return null;
  const scan = new Scanner(text);
  const [today, nowTime] = formatInTimeZone(now, timezone, "yyyy-MM-dd HH:mm").split(" ") as [string, string];

  const recurrence = readRecurrence(scan);
  const relative = readRelative(scan);
  const explicitTimeFirst = readTime(scan);
  const dateInfo = relative ? null : readDate(scan, today);
  // Depois de tirar a data, pode ter sobrado uma hora que só fazia sentido sem ela (ex.: "dia 10 às 15").
  const timeInfo = explicitTimeFirst.time || explicitTimeFirst.period ? explicitTimeFirst : readTime(scan);

  if (!recurrence && !relative && !dateInfo && !timeInfo.time && !timeInfo.period) return null;

  let date: string;
  let time: string;
  const explicit = timeInfo.time ? `${pad(timeInfo.time.hour)}:${pad(timeInfo.time.minute)}` : timeInfo.period ? PERIOD_TIME[timeInfo.period]! : null;

  if (relative && "minutes" in relative) {
    const at = new Date(Math.ceil(now.getTime() / 60_000) * 60_000 + relative.minutes * 60_000);
    [date, time] = formatInTimeZone(at, timezone, "yyyy-MM-dd HH:mm").split(" ") as [string, string];
  } else if (relative) {
    date = "days" in relative ? addDays(today, relative.days) : addMonths(today, relative.months);
    time = explicit ?? DEFAULT_TIME;
  } else if (dateInfo) {
    date = dateInfo.date;
    time = explicit ?? (date === today && DEFAULT_TIME <= nowTime ? (nextHourTime(nowTime) ?? "23:59") : DEFAULT_TIME);
  } else if (!recurrence) {
    // Só a hora ("às 15h", "à noite"): hoje se ainda dá tempo, senão amanhã.
    time = explicit ?? DEFAULT_TIME;
    date = time > nowTime ? today : addDays(today, 1);
  } else {
    date = today;
    time = explicit ?? DEFAULT_TIME;
  }

  let preset: RecurrencePreset = { kind: "once" };
  if (recurrence) {
    const anchor = date;
    switch (recurrence.kind) {
      case "weekly":
        preset = { kind: "weekly", days: recurrence.days ?? [weekdayOf(anchor)] };
        break;
      case "monthly_day":
        preset = { kind: "monthly_day", day: recurrence.day ?? parts(anchor)[2] };
        break;
      default:
        preset = recurrence;
    }
    date = firstOccurrence(preset, anchor, time, today, nowTime);
  }

  const sendAt = fromZonedTime(`${date}T${time}:00`, timezone);
  return {
    date,
    time,
    recurrence: preset,
    subject: extractSubject(text, scan.removed),
    sendAt,
    isPast: preset.kind === "once" && sendAt.getTime() <= now.getTime(),
  };
}

// ---------- descrição em português ("toda segunda às 09:00") ----------

const WEEKDAY_SHORT: Record<Weekday, string> = { SU: "dom", MO: "seg", TU: "ter", WE: "qua", TH: "qui", FR: "sex", SA: "sáb" };
const WEEKDAY_FULL: Record<Weekday, string> = {
  SU: "domingo",
  MO: "segunda",
  TU: "terça",
  WE: "quarta",
  TH: "quinta",
  FR: "sexta",
  SA: "sábado",
};
const WEEK_ORDER: Weekday[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

function joinPt(values: string[]): string {
  return values.length <= 1 ? (values[0] ?? "") : `${values.slice(0, -1).join(", ")} e ${values.at(-1)}`;
}

function dayLabel(date: string, today: string): string {
  if (date === today) return "hoje";
  if (date === addDays(today, 1)) return "amanhã";
  const [y, m, d] = parts(date);
  const base = `${WEEKDAY_SHORT[weekdayOf(date)]} ${pad(d)}/${pad(m)}`;
  return y === parts(today)[0] ? base : `${base}/${y}`;
}

/**
 * A repetição em português, sem a data de início: "toda segunda às 09:00",
 * "todo dia 10 às 08:00" — usada também pelas automações de horário (9.8).
 * `time` nulo deixa só a repetição ("toda segunda"); `yearlyDate` (yyyy-MM-dd)
 * dá o dia/mês do "todo ano".
 */
export function describeRecurrence(rec: RecurrencePreset, time: string | null, yearlyDate?: string): string {
  const at = time ? ` às ${time}` : "";
  switch (rec.kind) {
    case "once":
      return time ? `às ${time}` : "uma vez";
    case "daily":
      return `todo dia${at}`;
    case "weekdays":
      return `de segunda a sexta${at}`;
    case "weekly": {
      const days = WEEK_ORDER.filter((day) => rec.days.includes(day));
      if (days.length === 1) {
        const day = days[0]!;
        return `${day === "SA" || day === "SU" ? "todo" : "toda"} ${WEEKDAY_FULL[day]}${at}`;
      }
      return `às ${joinPt(days.map((day) => `${WEEKDAY_FULL[day]}s`))}${at}`;
    }
    case "monthly_day":
      return `todo dia ${rec.day}${at}`;
    case "monthly_last_weekday":
      return `${rec.day === "SA" || rec.day === "SU" ? "no último" : "na última"} ${WEEKDAY_FULL[rec.day]} de cada mês${at}`;
    case "yearly": {
      if (!yearlyDate) return `todo ano${at}`;
      const [, m, d] = parts(yearlyDate);
      return `todo ano em ${pad(d)}/${pad(m)}${at}`;
    }
    case "custom":
      return `recorrência personalizada${at}`;
  }
}

/** "amanhã às 09:00", "toda segunda e quarta às 08:00 (começa amanhã)" — prévia do que foi entendido. */
export function describeReminderPhrase(parsed: Pick<ParsedReminderPhrase, "date" | "time" | "recurrence">, now: Date, timezone: string): string {
  const today = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  if (parsed.recurrence.kind === "once") return `${dayLabel(parsed.date, today)} às ${parsed.time}`;
  return `${describeRecurrence(parsed.recurrence, parsed.time, parsed.date)} (começa ${dayLabel(parsed.date, today)})`;
}

/** A frase é um pedido de lembrete ("me lembra de…", "lembrar de…", "lembrete: …", "me avisa…") — a captura rápida usa pra criar lembrete em vez de nota. */
export function isReminderRequest(text: string): boolean {
  return /^\s*(?:me\s+(?:lembr(?:ar|a|e)|avis(?:ar|a|e))|lembrar\s+(?:de|que|do|da)|lembrete\s*[:-]?)(?=\s|$)/.test(normalize(text));
}
