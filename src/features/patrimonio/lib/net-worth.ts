export type NetWorthKind = "investimento" | "divida";

export interface MonthValue {
  month: string; // "yyyy-MM"
  valueCents: number;
}

export interface NetWorthItemSeries {
  kind: NetWorthKind;
  snapshots: MonthValue[];
}

export interface NetWorthMonthTotal {
  month: string;
  assetsCents: number;
  debtsCents: number;
  netCents: number;
}

/**
 * Preenche os meses sem registro repetindo o último valor conhecido —
 * diferente de um log diário (Água, 10.4), onde o dia sem toque é 0 de
 * verdade, aqui faltar o mês não significa que o investimento ou a
 * dívida zerou. Antes do primeiro registro, 0.
 */
export function fillMonthlySnapshots(snapshots: MonthValue[], months: string[]): MonthValue[] {
  const byMonth = new Map(snapshots.map((s) => [s.month, s.valueCents]));
  let last = 0;
  return months.map((month) => {
    if (byMonth.has(month)) last = byMonth.get(month)!;
    return { month, valueCents: last };
  });
}

/** Evolução do patrimônio líquido mês a mês (10.12): soma investimentos (ativos) e dívidas (passivos), já com as lacunas preenchidas. */
export function netWorthSeries(items: NetWorthItemSeries[], months: string[]): NetWorthMonthTotal[] {
  const filled = items.map((item) => ({ kind: item.kind, values: fillMonthlySnapshots(item.snapshots, months) }));
  return months.map((month, index) => {
    let assetsCents = 0;
    let debtsCents = 0;
    for (const item of filled) {
      const value = item.values[index]!.valueCents;
      if (item.kind === "investimento") assetsCents += value;
      else debtsCents += value;
    }
    return { month, assetsCents, debtsCents, netCents: assetsCents - debtsCents };
  });
}

/** Último valor conhecido de um item, pra mostrar na lista sem esperar o mês atual estar preenchido. `null` sem nenhum registro ainda. */
export function latestValueCents(snapshots: MonthValue[]): number | null {
  if (snapshots.length === 0) return null;
  return [...snapshots].sort((a, b) => b.month.localeCompare(a.month))[0]!.valueCents;
}
