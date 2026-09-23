import { endOfMonth, endOfQuarter, endOfYear, format, startOfMonth, startOfQuarter, startOfYear, subDays, subMonths, subQuarters } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const relativePeriods = ["last_month", "this_month", "last_7_days", "last_quarter", "this_year", "custom"] as const;
export type RelativePeriod = (typeof relativePeriods)[number];

export interface ResolvedPeriod {
  /** Início/fim do dia, no fuso do dono, já convertidos pra UTC — pra filtrar colunas `timestamptz`. */
  start: string;
  end: string;
  /** `AAAA-MM-DD` — pra filtrar colunas `date` puras (`fin_transactions.occurred_on` etc.), sem conversão de fuso. */
  startDateKey: string;
  endDateKey: string;
}

/**
 * Período relativo de um relatório (6.2) — resolvido no fuso do dono a
 * partir de "agora". `custom` exige `customStart`/`customEnd` (`AAAA-MM-DD`).
 */
export function resolveRelativePeriod(period: RelativePeriod, now: Date, timezone: string, custom?: { start: string; end: string }): ResolvedPeriod {
  const todayKey = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const today = new Date(`${todayKey}T00:00:00`);

  let startDateKey: string;
  let endDateKey: string;

  switch (period) {
    case "this_month":
      startDateKey = format(startOfMonth(today), "yyyy-MM-dd");
      endDateKey = format(endOfMonth(today), "yyyy-MM-dd");
      break;
    case "last_month": {
      const reference = subMonths(today, 1);
      startDateKey = format(startOfMonth(reference), "yyyy-MM-dd");
      endDateKey = format(endOfMonth(reference), "yyyy-MM-dd");
      break;
    }
    case "last_7_days":
      startDateKey = format(subDays(today, 6), "yyyy-MM-dd");
      endDateKey = todayKey;
      break;
    case "last_quarter": {
      const reference = subQuarters(today, 1);
      startDateKey = format(startOfQuarter(reference), "yyyy-MM-dd");
      endDateKey = format(endOfQuarter(reference), "yyyy-MM-dd");
      break;
    }
    case "this_year":
      startDateKey = format(startOfYear(today), "yyyy-MM-dd");
      endDateKey = format(endOfYear(today), "yyyy-MM-dd");
      break;
    case "custom":
      if (!custom) throw new Error('Período "custom" exige customStart/customEnd.');
      startDateKey = custom.start;
      endDateKey = custom.end;
      break;
    default: {
      const exhaustive: never = period;
      throw new Error(`Período desconhecido: ${String(exhaustive)}`);
    }
  }

  return {
    startDateKey,
    endDateKey,
    start: fromZonedTime(`${startDateKey}T00:00:00`, timezone).toISOString(),
    end: fromZonedTime(`${endDateKey}T23:59:59.999`, timezone).toISOString(),
  };
}
