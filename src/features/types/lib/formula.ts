import type { FieldDefinition, FieldType } from "../schemas";

/**
 * Campo "Fórmula" (9.6): conta simples entre colunas do próprio item —
 * `quantidade × preço`, `(receita - custo) / receita`, `valor * 1,1`. Nunca
 * é gravado (como o `rollup`): é calculado quando o item é lido. Aceita
 * `+ - * / × ÷`, parênteses, números com vírgula ou ponto e nomes de campos
 * numéricos (pelo nome que aparece na tela ou pela chave), sem acento e sem
 * diferenciar maiúsculas.
 *
 * Unidades, pra conta sair do jeito que se fala:
 * - dinheiro entra em **reais** (o valor gravado em centavos ÷ 100) e, se o
 *   resultado for mostrado como dinheiro, volta pra centavos arredondados;
 * - porcentagem entra como fração (10% → 0,1) e, mostrada como porcentagem,
 *   volta ×100.
 */
export const FORMULA_FORMATS = ["number", "money", "percent"] as const;
export type FormulaFormat = (typeof FORMULA_FORMATS)[number];

export const FORMULA_FORMAT_LABELS: Record<FormulaFormat, string> = { number: "Número", money: "Dinheiro", percent: "Porcentagem" };

/** Tipos que podem entrar numa fórmula. Fórmula dentro de fórmula não (evita ciclo). */
export const FORMULA_INPUT_TYPES: FieldType[] = ["number", "money", "percent", "rating", "duration", "rollup"];

export const MAX_FORMULA_LENGTH = 300;

type Node =
  | { kind: "num"; value: number }
  | { kind: "ref"; key: string }
  | { kind: "neg"; arg: Node }
  | { kind: "bin"; op: "+" | "-" | "*" | "/"; left: Node; right: Node };

type Token = { type: "num"; value: number } | { type: "name"; value: string } | { type: "op"; value: "+" | "-" | "*" | "/" | "(" | ")" };

export class FormulaError extends Error {}

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  const source = expression.replace(/×/g, "*").replace(/÷/g, "/");
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if ("+-*/()".includes(ch)) {
      tokens.push({ type: "op", value: ch as "+" });
      i += 1;
      continue;
    }
    // Número: 10 · 1,5 · 1.5 · 1.234,56 (milhar com ponto e decimal com vírgula).
    const number = /^\d+(?:\.\d{3})*(?:,\d+)?(?![\d.])|^\d+(?:\.\d+)?/.exec(source.slice(i));
    if (number && !/[\p{L}_]/u.test(source[i + number[0].length] ?? "")) {
      const raw = number[0];
      const value = raw.includes(",") ? Number(raw.replace(/\./g, "").replace(",", ".")) : Number(raw);
      tokens.push({ type: "num", value });
      i += raw.length;
      continue;
    }
    // Nome de campo: letras (com acento), números, espaço e _ — até o próximo operador ou parêntese.
    const name = /^[\p{L}\p{N}_ ]+/u.exec(source.slice(i));
    if (name) {
      tokens.push({ type: "name", value: name[0].trim() });
      i += name[0].length;
      continue;
    }
    throw new FormulaError(`Não entendi o caractere “${ch}”.`);
  }
  return tokens;
}

function parse(tokens: Token[], resolve: (name: string) => string): Node {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (value: string) => {
    const token = peek();
    return token?.type === "op" && token.value === value;
  };

  function primary(): Node {
    const token = peek();
    if (!token) throw new FormulaError("A fórmula terminou no meio da conta.");
    if (token.type === "num") {
      pos += 1;
      return { kind: "num", value: token.value };
    }
    if (token.type === "name") {
      pos += 1;
      return { kind: "ref", key: resolve(token.value) };
    }
    if (token.value === "(") {
      pos += 1;
      const inner = expression();
      if (!isOp(")")) throw new FormulaError("Falta fechar um parêntese.");
      pos += 1;
      return inner;
    }
    if (token.value === "-") {
      pos += 1;
      return { kind: "neg", arg: primary() };
    }
    if (token.value === "+") {
      pos += 1;
      return primary();
    }
    throw new FormulaError(token.value === ")" ? "Tem um parêntese fechando sem abrir." : `Faltou um valor antes de “${token.value}”.`);
  }

  function term(): Node {
    let node = primary();
    while (isOp("*") || isOp("/")) {
      const op = (peek() as { value: "*" | "/" }).value;
      pos += 1;
      node = { kind: "bin", op, left: node, right: primary() };
    }
    return node;
  }

  function expression(): Node {
    let node = term();
    while (isOp("+") || isOp("-")) {
      const op = (peek() as { value: "+" | "-" }).value;
      pos += 1;
      node = { kind: "bin", op, left: node, right: term() };
    }
    return node;
  }

  if (tokens.length === 0) throw new FormulaError("A fórmula está vazia.");
  const tree = expression();
  if (pos < tokens.length) {
    const token = tokens[pos]!;
    throw new FormulaError(token.type === "op" && token.value === ")" ? "Tem um parêntese fechando sem abrir." : "Faltou um operador (+ - × ÷) entre dois valores.");
  }
  return tree;
}

/** Campos que a fórmula pode usar, por nome normalizado (rótulo e chave). */
function referenceTable(fields: FieldDefinition[], selfKey?: string): Map<string, FieldDefinition> {
  const table = new Map<string, FieldDefinition>();
  for (const field of fields) {
    if (field.key === selfKey || !FORMULA_INPUT_TYPES.includes(field.type)) continue;
    table.set(normalizeName(field.key), field);
    table.set(normalizeName(field.label), field);
  }
  return table;
}

export interface CompiledFormula {
  tree: Node;
  /** Chaves dos campos usados. */
  refs: string[];
}

/** Lê a fórmula; erro em português (pro formulário do campo) se não der. */
export function compileFormula(expression: string, fields: FieldDefinition[], selfKey?: string): CompiledFormula {
  if (expression.length > MAX_FORMULA_LENGTH) throw new FormulaError("Fórmula muito longa.");
  const table = referenceTable(fields, selfKey);
  const allByName = new Map(fields.flatMap((field) => [[normalizeName(field.key), field] as const, [normalizeName(field.label), field] as const]));
  const refs = new Set<string>();
  const tree = parse(tokenize(expression), (name) => {
    const field = table.get(normalizeName(name));
    if (!field) {
      const other = allByName.get(normalizeName(name));
      if (other && selfKey !== undefined && other.key === selfKey) throw new FormulaError("A fórmula não pode usar ela mesma.");
      if (other) throw new FormulaError(`“${other.label}” não é um campo de número, dinheiro ou porcentagem.`);
      throw new FormulaError(`Não achei o campo “${name}”.`);
    }
    refs.add(field.key);
    return field.key;
  });
  return { tree, refs: [...refs] };
}

/** Mensagem de erro, ou `null` se a fórmula está boa. */
export function validateFormula(expression: string, fields: FieldDefinition[], selfKey?: string): string | null {
  try {
    compileFormula(expression, fields, selfKey);
    return null;
  } catch (error) {
    return error instanceof FormulaError ? error.message : "Fórmula inválida.";
  }
}

function inputValue(field: FieldDefinition, raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isFinite(value)) return null;
  if (field.type === "money") return value / 100;
  if (field.type === "percent") return value / 100;
  return value;
}

function evaluate(node: Node, values: Map<string, number | null>): number | null {
  switch (node.kind) {
    case "num":
      return node.value;
    case "ref":
      return values.get(node.key) ?? null;
    case "neg": {
      const arg = evaluate(node.arg, values);
      return arg === null ? null : -arg;
    }
    case "bin": {
      const left = evaluate(node.left, values);
      const right = evaluate(node.right, values);
      if (left === null || right === null) return null;
      if (node.op === "+") return left + right;
      if (node.op === "-") return left - right;
      if (node.op === "*") return left * right;
      return right === 0 ? null : left / right;
    }
  }
}

/** Valor final no formato de armazenamento do "mostrar como": dinheiro em centavos, porcentagem ×100, número com até 6 casas. */
function toStored(result: number, format: FormulaFormat): number {
  if (format === "money") return Math.round(result * 100);
  if (format === "percent") return Math.round(result * 100 * 100) / 100;
  return Math.round(result * 1e6) / 1e6;
}

/**
 * Valores de todos os campos `formula` do tipo pra um item. Campo vazio que a
 * fórmula usa, divisão por zero ou fórmula quebrada → sem valor (fica "—"),
 * nunca um erro na tela.
 */
export function computeFormulas(fields: FieldDefinition[], properties: Record<string, unknown>): Record<string, number | null> {
  const formulaFields = fields.filter((field) => field.type === "formula" && field.formula);
  if (formulaFields.length === 0) return {};
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const result: Record<string, number | null> = {};
  for (const field of formulaFields) {
    try {
      const compiled = compileFormula(field.formula!, fields, field.key);
      const values = new Map(compiled.refs.map((key) => [key, inputValue(byKey.get(key)!, properties[key])]));
      const value = evaluate(compiled.tree, values);
      result[field.key] = value === null || !Number.isFinite(value) ? null : toStored(value, field.formulaFormat ?? "number");
    } catch {
      result[field.key] = null;
    }
  }
  return result;
}
