import { formatInTimeZone } from "date-fns-tz";
import { parseReminderPhrase } from "@/features/reminders/lib/parse-reminder-phrase";
import { formatBRL } from "@/lib/money";

/**
 * "Pagar pastéis do clube Leo R$ 60 dia 10" vira conta a pagar (pedido da
 * dona, 03/10): antes a captura e o "me lembra de…" só criavam nota ou
 * lembrete, e o valor se perdia. Precisa de um verbo de dinheiro (pagar,
 * conta, boleto… / receber, cobrar) **e** de um valor com "R$" ou "reais" —
 * "dia 10" sozinho é data, não dinheiro.
 */
export interface ParsedBillPhrase {
  direction: "payable" | "receivable";
  description: string;
  amountCents: number;
  /** Mesmo formato que o formulário de conta aceita ("60,00"). */
  amount: string;
  dueOn: string;
  /** A data veio da frase (senão, vence hoje). */
  dueFromPhrase: boolean;
}

const PAY_WORDS = /\b(pagar|pago|paga|conta|contas|boleto|fatura|mensalidade|parcela|aluguel|condominio)\b/;
const RECEIVE_WORDS = /\b(receber|cobrar|me\s+pag(?:ar|a|ue)m?|me\s+deve|devendo)\b/;

// "R$ 1.234,56", "R$60", "60 reais", "60,50 reais", "1200 reais".
const AMOUNT = /(?:r\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?))|(?:\b(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:reais|real|conto|contos|pila)\b)/i;

function strip(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function toCents(raw: string): number {
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, "") : raw;
  return Math.round(Number(normalized) * 100);
}

const LEADING_NOISE = /^\s*(?:me\s+(?:lembr(?:ar|a|e)|avis(?:ar|a|e))\s+(?:de\s+|que\s+)?|lembrar\s+(?:de\s+|que\s+)?|lembrete\s*[:-]?\s*)/i;
const LEADING_VERB = /^\s*(?:tenho\s+que\s+|preciso\s+)?(?:pagar|receber|cobrar)\s+(?:(?:o|a|os|as)\s+)?/i;

function cleanDescription(text: string): string {
  let s = text.replace(LEADING_NOISE, "").replace(LEADING_VERB, "");
  s = s.replace(/\s+(?:de|do|da|no|na|em|pra|para|por|com|,|-)\s*$/i, "");
  s = s.replace(/\s{2,}/g, " ").replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

export function parseBillPhrase(text: string, now: Date, timezone: string): ParsedBillPhrase | null {
  if (!text.trim()) return null;
  const firstLine = text.split("\n")[0]!;
  const plain = strip(firstLine);
  const receivable = RECEIVE_WORDS.test(plain);
  if (!receivable && !PAY_WORDS.test(plain)) return null;

  const match = AMOUNT.exec(firstLine);
  if (!match) return null;
  const amountCents = toCents((match[1] ?? match[2])!);
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null;

  // Sem o valor, o resto é descrição + quando ("dia 10", "sexta", "amanhã").
  const withoutAmount = `${firstLine.slice(0, match.index)} ${firstLine.slice(match.index + match[0].length)}`.replace(/\s{2,}/g, " ").trim();
  const when = parseReminderPhrase(withoutAmount, now, timezone);
  const dueOn = when?.date ?? formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const description = cleanDescription(when ? when.subject : withoutAmount) || (receivable ? "Conta a receber" : "Conta a pagar");

  return {
    direction: receivable ? "receivable" : "payable",
    description: description.slice(0, 200),
    amountCents,
    amount: formatBRL(amountCents).replace(/^R\$\s*/, "").trim(),
    dueOn,
    dueFromPhrase: Boolean(when),
  };
}
