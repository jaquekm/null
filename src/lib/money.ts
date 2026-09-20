/** Sempre inteiro — nunca `float`/`numeric` pra dinheiro no código (CLAUDE.md). */
export type Cents = number;

const CURRENCY_PREFIX_RE = /r\$\s*/gi;
const ALLOWED_CHARS_RE = /^[0-9.,]+$/;

function invalid(original: string, reason: "ambíguo" | "inválido"): never {
  throw new Error(`Valor monetário ${reason}: "${original}".`);
}

function toCents(integerPart: string, decimalPart: string, original: string): number {
  if (integerPart === "" || !/^\d+$/.test(integerPart)) invalid(original, "inválido");
  const cents = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) invalid(original, "inválido");
  return cents;
}

/**
 * `"1.234,56"` (BRL) e `"1234.56"` (OFX) são aceitos; qual separador é o
 * decimal se resolve pela posição (o último) quando os dois aparecem, ou
 * pela contagem de dígitos depois dele quando só um aparece — 1-2 dígitos é
 * centavos, exatamente 3 é separador de milhar (sem centavos). Qualquer
 * outro caso (vírgula seguida de 3+ dígitos sem ponto, por exemplo) é
 * ambíguo demais pra adivinhar e lança erro em vez de arriscar o valor errado.
 */
export function parseBRL(input: string): Cents {
  const original = input;
  let s = input.trim().replace(CURRENCY_PREFIX_RE, "").trim();
  if (s === "") invalid(original, "inválido");

  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1).trim();
  }

  if (!ALLOWED_CHARS_RE.test(s)) invalid(original, "inválido");

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  let cents: number;

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalIndex = Math.max(lastDot, lastComma);
    const thousandsChar = decimalIndex === lastComma ? "." : ",";
    const integerPart = s.slice(0, decimalIndex).split(thousandsChar).join("");
    const decimalPart = s.slice(decimalIndex + 1);
    if (!/^\d{1,2}$/.test(decimalPart)) invalid(original, "inválido");
    cents = toCents(integerPart, decimalPart, original);
  } else if (lastComma !== -1) {
    const parts = s.split(",");
    if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1]!)) invalid(original, "ambíguo");
    cents = toCents(parts[0]!, parts[1]!, original);
  } else if (lastDot !== -1) {
    const dotCount = (s.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      cents = toCents(s.split(".").join(""), "00", original);
    } else {
      const [integerPart, decimalPart] = s.split(".") as [string, string];
      if (!/^\d+$/.test(decimalPart)) invalid(original, "inválido");
      if (decimalPart.length === 3) {
        cents = toCents(integerPart + decimalPart, "00", original);
      } else if (decimalPart.length === 1 || decimalPart.length === 2) {
        cents = toCents(integerPart, decimalPart, original);
      } else {
        invalid(original, "inválido");
      }
    }
  } else {
    cents = toCents(s, "00", original);
  }

  return negative ? -cents : cents;
}

/** `123456 → "R$ 1.234,56"`. `opts.sign`: força `+`/`-` explícito (útil pra listar entrada/saída lado a lado). */
export function formatBRL(cents: Cents, opts: { sign?: boolean } = {}): string {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    signDisplay: opts.sign ? "exceptZero" : "auto",
  }).format(cents / 100);
  // Node às vezes usa espaço fino/não-quebrável (U+00A0) entre "R$" e o número — normaliza pra espaço comum.
  return formatted.replace(/ /g, " ");
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}

/** Distribui `total` em `n` partes o mais iguais possível; o resto (em centavos) vai 1 a 1 pros primeiros. */
export function splitEqual(total: Cents, n: number): Cents[] {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("splitEqual: n precisa ser um inteiro positivo.");
  }

  const base = Math.trunc(total / n);
  const remainder = total - base * n;
  const remainderAbs = Math.abs(remainder);
  const step = remainder >= 0 ? 1 : -1;

  const result = new Array<Cents>(n).fill(base);
  for (let i = 0; i < remainderAbs; i++) {
    result[i]! += step;
  }
  return result;
}

/**
 * Método do maior resto (largest remainder method): cada participante recebe
 * o piso da sua fração proporcional; o resto (sempre um inteiro de centavos)
 * vai 1 a 1 pra quem tem a maior parte fracionária, maior primeiro — empate
 * mantém a ordem original (mesmo critério do `splitEqual`).
 */
export function splitByWeights(total: Cents, weights: number[]): Cents[] {
  if (weights.length === 0) {
    throw new Error("splitByWeights: weights não pode ser vazio.");
  }
  if (weights.some((w) => w < 0)) {
    throw new Error("splitByWeights: pesos não podem ser negativos.");
  }
  const totalWeight = sumCents(weights);
  if (!(totalWeight > 0)) {
    throw new Error("splitByWeights: soma dos pesos precisa ser positiva.");
  }

  const sign = total < 0 ? -1 : 1;
  const absTotal = Math.abs(total);

  const shares = weights.map((w) => (absTotal * w) / totalWeight);
  const floors = shares.map((share) => Math.floor(share));
  const remainder = absTotal - sumCents(floors);

  const order = shares
    .map((share, index) => ({ index, frac: share - Math.floor(share) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (let i = 0; i < remainder; i++) {
    result[order[i]!.index]! += 1;
  }

  return result.map((v) => v * sign);
}
