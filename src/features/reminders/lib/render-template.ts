import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

const TEMPLATE_VAR_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Variáveis fixas do template (3.8) — sempre disponíveis, além das de `reminders.variables`. */
export const FIXED_TEMPLATE_VARS = [
  "nome",
  "nome_completo",
  "data",
  "hora",
  "dia_semana",
  "valor",
  "link",
  "titulo",
] as const;

/** Nomes de variável `{{...}}` referenciadas no template, sem repetição. */
export function extractTemplateVariables(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(TEMPLATE_VAR_REGEX)) {
    found.add(match[1]!);
  }
  return [...found];
}

/** Variáveis do template que não são fixas nem estão em `extraKeys` (`reminders.variables`) — erro de validação ao salvar. */
export function findUnknownTemplateVariables(template: string, extraKeys: string[]): string[] {
  const known = new Set<string>([...FIXED_TEMPLATE_VARS, ...extraKeys]);
  return extractTemplateVariables(template).filter((name) => !known.has(name));
}

/** Substitui `{{var}}` pelos valores em `vars`; uma variável sem valor correspondente é deixada como está. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(TEMPLATE_VAR_REGEX, (match, name: string) => (name in vars ? vars[name]! : match));
}

export interface TemplateRecipient {
  /** Apelido ou nome do contato — `null`/ausente quando o destinatário é o próprio dono ("eu"). */
  nickname?: string | null;
  name?: string | null;
}

export interface BuildTemplateVarsInput {
  title: string;
  occurrenceAt: Date;
  timezone: string;
  recipient?: TemplateRecipient | null;
  link?: string | null;
  amountCents?: number | null;
  extra?: Record<string, string>;
}

/**
 * Resolve o conjunto fixo de variáveis do template pra uma ocorrência (3.8).
 * `nome`/`nome_completo` ficam vazios quando o destinatário é o dono
 * (lembrete pessoal não costuma usar essas variáveis).
 */
export function buildTemplateVars(input: BuildTemplateVarsInput): Record<string, string> {
  const nomeCompleto = input.recipient?.name?.trim() ?? "";
  const nome = input.recipient?.nickname?.trim() || nomeCompleto.split(/\s+/)[0] || "";

  return {
    nome,
    nome_completo: nomeCompleto,
    data: formatInTimeZone(input.occurrenceAt, input.timezone, "dd/MM/yyyy"),
    hora: formatInTimeZone(input.occurrenceAt, input.timezone, "HH:mm"),
    dia_semana: formatInTimeZone(input.occurrenceAt, input.timezone, "EEEE", { locale: ptBR }),
    valor: input.amountCents != null ? (input.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
    link: input.link ?? "",
    titulo: input.title,
    ...input.extra,
  };
}
