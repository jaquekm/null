/**
 * Documentos com vencimento (9.5): passaporte, CNH, RG, seguro, contrato,
 * garantia… A validade fica em `items.properties.validade` (yyyy-MM-dd),
 * gravada só pela ação própria (como o tipo de lista) — assim funciona em
 * qualquer tipo de item, sem mexer nos campos configuráveis. Regras puras.
 */
export const EXPIRY_PROPERTY = "validade";
/** Avisos antes do vencimento, em dias, sempre às 9h. */
export const EXPIRY_ALERT_DAYS = [30, 7, 1] as const;
export const EXPIRY_ALERT_TIME = "09:00";
/** O Hoje mostra o que vence nos próximos 30 dias e o que venceu há até 30 dias. */
export const EXPIRY_WINDOW_DAYS = 30;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDaysIso(date: string, days: number): string {
  return new Date(toUtc(date) + days * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/** A validade gravada no item, se for uma data válida. */
export function expiryOf(properties: Record<string, unknown> | null | undefined): string | null {
  const value = properties?.[EXPIRY_PROPERTY];
  if (typeof value !== "string" || !ISO_DATE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return isRealDate(y!, m!, d!) ? value : null;
}

export type ExpiryLevel = "expired" | "today" | "soon" | "ok";

export interface ExpiryStatus {
  daysLeft: number;
  level: ExpiryLevel;
  /** "vence em 12 dias", "vence amanhã", "venceu há 3 dias"… */
  label: string;
}

export function expiryStatus(expiry: string, today: string): ExpiryStatus {
  const daysLeft = daysBetween(today, expiry);
  if (daysLeft < 0) {
    const ago = -daysLeft;
    return { daysLeft, level: "expired", label: ago === 1 ? "venceu ontem" : `venceu há ${ago} dias` };
  }
  if (daysLeft === 0) return { daysLeft, level: "today", label: "vence hoje" };
  const label = daysLeft === 1 ? "vence amanhã" : `vence em ${daysLeft} dias`;
  return { daysLeft, level: daysLeft <= EXPIRY_WINDOW_DAYS ? "soon" : "ok", label };
}

export interface ExpiryAlert {
  daysBefore: number;
  /** Dia do aviso (yyyy-MM-dd), às 9h. */
  date: string;
}

/** Avisos de 30, 7 e 1 dia antes que ainda não passaram (o de hoje fica — o servidor confere a hora). */
export function expiryAlerts(expiry: string, today: string): ExpiryAlert[] {
  return EXPIRY_ALERT_DAYS.map((daysBefore) => ({ daysBefore, date: addDaysIso(expiry, -daysBefore) })).filter((alert) => alert.date >= today);
}

export function expiryAlertMessage(daysBefore: number): string {
  return daysBefore === 1 ? "📄 {{titulo}} vence amanhã ({{validade}}).\n{{link}}" : `📄 {{titulo}} vence em ${daysBefore} dias ({{validade}}).\n{{link}}`;
}

export function formatExpiry(expiry: string): string {
  const [y, m, d] = expiry.split("-");
  return `${d}/${m}/${y}`;
}

// ---------- sugestão a partir do texto do anexo (OCR) ----------

const MONTHS: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};
/** Palavras que marcam a data de validade num documento — sem elas, nenhuma data é sugerida (emissão e nascimento também são datas). */
const KEYWORD = /(data\s+de\s+validade|validade|v[aá]lid[oa]\s+at[eé]|vencimento|vence\s+em|expira(?:\s+em|[cç][aã]o)?|expiry(?:\s+date)?|date\s+of\s+expiry|valid\s+until|vigência\s+at[eé]|vigencia\s+at[eé]|fim\s+da\s+vig[eê]ncia)/gi;
const DATE_PATTERNS: RegExp[] = [
  /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/,
  /\b(\d{1,2})\s+(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?\s+(?:de\s+)?(\d{4})\b/i,
  /\b(\d{4})-(\d{2})-(\d{2})\b/,
];

function dateFrom(match: RegExpExecArray, index: number): string | null {
  let year: number;
  let month: number;
  let day: number;
  if (index === 2) {
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if (index === 1) {
    [day, month, year] = [Number(match[1]), MONTHS[match[2]!.toLowerCase().slice(0, 3)]!, Number(match[3])];
  } else {
    [day, month] = [Number(match[1]), Number(match[2])];
    year = match[3]!.length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  }
  if (year < 1990 || year > 2100 || !isRealDate(year, month, day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Data de validade lida no texto do anexo (OCR), pra **sugerir** — a dona
 * confirma, nunca grava sozinho. Só olha a primeira data que aparece logo
 * depois (até ~40 caracteres) de "validade", "válido até", "vencimento"…
 * Várias ocorrências: fica a mais distante no futuro (a validade costuma ser
 * a última data do documento; "1ª habilitação" e emissão vêm antes).
 */
export function suggestExpiryFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const found: string[] = [];
  for (const keyword of text.matchAll(KEYWORD)) {
    const after = text.slice(keyword.index! + keyword[0].length, keyword.index! + keyword[0].length + 40);
    let best: { at: number; date: string } | null = null;
    DATE_PATTERNS.forEach((pattern, index) => {
      const match = pattern.exec(after);
      if (!match) return;
      const date = dateFrom(match, index);
      if (date && (!best || match.index < best.at)) best = { at: match.index, date };
    });
    if (best) found.push((best as { date: string }).date);
  }
  if (found.length === 0) return null;
  return found.sort().at(-1)!;
}
