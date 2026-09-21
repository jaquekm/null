import type { ParsedStatementRow } from "./statement-row";

/**
 * Extrai o valor de uma tag SGML ou XML a partir da abertura: pega tudo até
 * `</TAG>` (XML) ou até a próxima tag/quebra de linha (SGML, tag sem
 * fechamento) — as duas formas terminam em `<` ou `\r`/`\n`, então a mesma
 * regex cobre ambas sem precisar saber de antemão qual dialeto é.
 */
function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, "i"));
  const value = match?.[1]?.trim();
  return value ? value : null;
}

/** `DTPOSTED` vem como `YYYYMMDD` (podendo ter hora/fuso depois, ex.: `20260115120000[-3:BRT]`) — só os 8 primeiros dígitos importam. */
function parseOfxDate(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}

/** `TRNAMT` no OFX é sempre ponto decimal, independente do idioma do banco. */
function parseOfxAmount(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw.replace(/\s/g, ""));
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/**
 * Parser tolerante de OFX (4.5): cobre tanto OFX 1.x/SGML (tags sem
 * fechamento) quanto OFX 2.x/XML (tags fechadas) com a mesma lógica — acha
 * cada bloco `<STMTTRN>...` até a próxima `<STMTTRN>`, `</STMTTRN>` ou
 * `</BANKTRANLIST>`, e dentro dele lê `FITID`/`DTPOSTED`/`TRNAMT`/`MEMO`/`NAME`.
 * Não tenta validar o resto do documento (cabeçalho, `<SIGNONMSGSRSV1>` etc.)
 * — só extrai as transações, que é tudo que a importação precisa.
 */
export function parseOfx(content: string): ParsedStatementRow[] {
  const blocks: string[] = [];
  const re = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/STMTTRN>|<\/BANKTRANLIST>)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    blocks.push(match[1]!);
  }

  return blocks.map((block) => {
    const fitid = extractTag(block, "FITID");
    const occurredOn = parseOfxDate(extractTag(block, "DTPOSTED"));
    const amountCents = parseOfxAmount(extractTag(block, "TRNAMT"));
    const description = extractTag(block, "MEMO") ?? extractTag(block, "NAME") ?? "";

    const errors: string[] = [];
    if (!occurredOn) errors.push("data inválida");
    if (amountCents === null) errors.push("valor inválido");
    if (!description) errors.push("sem descrição");

    return { fitid, occurredOn, amountCents, description, error: errors.length > 0 ? errors.join(", ") : null };
  });
}
