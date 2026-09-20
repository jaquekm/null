import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { RRule } from "rrule";

/**
 * `rrule` (2.8.1) faz toda a matemática de recorrência usando os métodos
 * `getUTC*`/`setUTC*` do `Date` — ele nunca olha pro fuso real do host, só
 * trata os números como se já fossem "a hora certa". Pra recorrência num
 * fuso de verdade (`timezone`), a técnica (padrão conhecido do `rrule`) é:
 * converter o instante real pro relógio de parede daquele fuso, **fingir**
 * que esses números são UTC (`floating`) pra alimentar o `rrule`, e
 * desfazer o mesmo truque na volta. `DTSTART` de uma regra nova precisa
 * ser escrito com o mesmo truque (`buildRRuleString` abaixo), senão a hora
 * do dia que o `rrule` usa pras ocorrências fica errada.
 */
function toFloatingDate(instant: Date, timezone: string): Date {
  const local = formatInTimeZone(instant, timezone, "yyyy-MM-dd'T'HH:mm:ss");
  const [datePart, timePart] = local.split("T");
  const [year, month, day] = datePart!.split("-").map(Number);
  const [hour, minute, second] = timePart!.split(":").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, hour!, minute!, second!));
}

function fromFloatingDate(floating: Date, timezone: string): Date {
  const local = `${floating.getUTCFullYear()}-${String(floating.getUTCMonth() + 1).padStart(2, "0")}-${String(floating.getUTCDate()).padStart(2, "0")}T${String(floating.getUTCHours()).padStart(2, "0")}:${String(floating.getUTCMinutes()).padStart(2, "0")}:${String(floating.getUTCSeconds()).padStart(2, "0")}`;
  return fromZonedTime(local, timezone);
}

/**
 * Próxima ocorrência de uma regra RRULE (RFC 5545) depois de `after`,
 * calculada no fuso do lembrete (3.8) — `null` se a regra não tem mais
 * ocorrências (`COUNT`/`UNTIL` esgotados) ou se a string for inválida.
 */
export function nextOccurrence(rruleString: string, timezone: string, after: Date): Date | null {
  let rule: RRule;
  try {
    rule = RRule.fromString(rruleString);
  } catch {
    return null;
  }

  const floatingAfter = toFloatingDate(after, timezone);
  const floatingNext = rule.after(floatingAfter, false);
  if (!floatingNext) return null;

  return fromFloatingDate(floatingNext, timezone);
}

export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

/** Presets da UI (3.8) — "uma vez" não tem RRULE (`reminders.rrule = null`, ocorrência única). */
export type RecurrencePreset =
  | { kind: "once" }
  | { kind: "daily" }
  | { kind: "weekdays" }
  | { kind: "weekly"; days: Weekday[] }
  | { kind: "monthly_day"; day: number }
  | { kind: "monthly_last_weekday"; day: Weekday }
  | { kind: "yearly" }
  | { kind: "custom"; rrule: string };

function formatFloatingDtstart(instant: Date, timezone: string): string {
  const floating = toFloatingDate(instant, timezone);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${floating.getUTCFullYear()}${pad(floating.getUTCMonth() + 1)}${pad(floating.getUTCDate())}T${pad(floating.getUTCHours())}${pad(floating.getUTCMinutes())}${pad(floating.getUTCSeconds())}Z`;
}

/** Monta a string RRULE (com `DTSTART`) a partir de um preset da UI — `null` pra "uma vez". */
export function buildRRuleString(preset: RecurrencePreset, dtstart: Date, timezone: string): string | null {
  if (preset.kind === "once") return null;
  if (preset.kind === "custom") return preset.rrule;

  let rulePart: string;
  switch (preset.kind) {
    case "daily":
      rulePart = "FREQ=DAILY";
      break;
    case "weekdays":
      rulePart = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
      break;
    case "weekly":
      rulePart = `FREQ=WEEKLY;BYDAY=${preset.days.join(",")}`;
      break;
    case "monthly_day":
      rulePart = `FREQ=MONTHLY;BYMONTHDAY=${preset.day}`;
      break;
    case "monthly_last_weekday":
      rulePart = `FREQ=MONTHLY;BYDAY=-1${preset.day}`;
      break;
    case "yearly":
      rulePart = "FREQ=YEARLY";
      break;
  }

  return `DTSTART:${formatFloatingDtstart(dtstart, timezone)}\nRRULE:${rulePart}`;
}

/**
 * Volta de uma string RRULE pro preset da UI (edição, 3.8) — reconhece
 * exatamente as formas que `buildRRuleString` produz; qualquer outra coisa
 * (regra digitada à mão, ou vinda de outro sistema) vira "personalizado".
 */
export function parseRecurrencePreset(rruleString: string | null): RecurrencePreset {
  if (!rruleString) return { kind: "once" };

  const rulePart = rruleString.split("\n").find((line) => line.startsWith("RRULE:"));
  if (!rulePart) return { kind: "custom", rrule: rruleString };

  const params = new Map(
    rulePart
      .slice("RRULE:".length)
      .split(";")
      .map((pair) => pair.split("=") as [string, string]),
  );
  const freq = params.get("FREQ");
  const byday = params.get("BYDAY");

  if (freq === "DAILY" && params.size === 1) return { kind: "daily" };
  if (freq === "WEEKLY" && byday === "MO,TU,WE,TH,FR" && params.size === 2) return { kind: "weekdays" };
  if (freq === "WEEKLY" && byday && params.size === 2) return { kind: "weekly", days: byday.split(",") as Weekday[] };
  if (freq === "MONTHLY" && params.has("BYMONTHDAY") && params.size === 2) {
    return { kind: "monthly_day", day: Number(params.get("BYMONTHDAY")) };
  }
  if (freq === "MONTHLY" && byday && /^-1[A-Z]{2}$/.test(byday) && params.size === 2) {
    return { kind: "monthly_last_weekday", day: byday.slice(2) as Weekday };
  }
  if (freq === "YEARLY" && params.size === 1) return { kind: "yearly" };

  return { kind: "custom", rrule: rruleString };
}
