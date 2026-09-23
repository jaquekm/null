import { fromZonedTime } from "date-fns-tz";

export interface PeriodBoundsUtc {
  startUtc: string | null;
  endUtc: string | null;
}

/**
 * Converte o período "de/até" do escopo (`YYYY-MM-DD`, dia local do dono) em
 * limites UTC — mesma conversão de `resolveRelativePeriod` (6.2), pra
 * comparar com `items.updated_at` (`timestamptz`) sem cair na armadilha de
 * comparar string local com string UTC direto (quebra perto da virada do dia).
 */
export function periodBoundsUtc(dateFrom: string | undefined, dateTo: string | undefined, timezone: string): PeriodBoundsUtc {
  return {
    startUtc: dateFrom ? fromZonedTime(`${dateFrom}T00:00:00`, timezone).toISOString() : null,
    endUtc: dateTo ? fromZonedTime(`${dateTo}T23:59:59.999`, timezone).toISOString() : null,
  };
}

/** Ambos os limites já são ISO UTC (formato fixo, largura fixa) — comparação de string é segura. */
export function isWithinPeriodUtc(timestampUtc: string, bounds: PeriodBoundsUtc): boolean {
  if (bounds.startUtc && timestampUtc < bounds.startUtc) return false;
  if (bounds.endUtc && timestampUtc > bounds.endUtc) return false;
  return true;
}
