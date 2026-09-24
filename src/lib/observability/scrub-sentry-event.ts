/**
 * `beforeSend` do Sentry (7.6): "removendo conteúdo de notas, valores
 * financeiros e dados de contatos dos eventos" — como o SDK não sabe o que é
 * dado sensível neste app, a defesa é por **nome de campo**: qualquer chave
 * (em qualquer profundidade do evento — corpo de requisição, breadcrumbs,
 * `extra`, `contexts`) que bata com esse padrão vira `"[removido]"` antes de
 * sair pro Sentry. Função pura — não depende do SDK, só do formato de
 * evento (`{ request, extra, contexts, breadcrumbs, ... }`), pra dar pra
 * testar sem inicializar Sentry de verdade.
 */
const SENSITIVE_KEY_PATTERN =
  /content|title|body|properties|notes?|description|email|phone|address|contact|amount|balance|cents|pix|iban|cpf|cnpj|password|secret|token|authorization|cookie/i;

const MAX_DEPTH = 8;

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH || value == null) return value;

  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));

  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(source)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[removido]" : scrubValue(val, depth + 1);
    }
    return result;
  }

  return value;
}

/** Evento do Sentry — tipado frouxo de propósito (`Record<string, unknown>`) pra não acoplar este módulo puro à versão exata do SDK; quem chama (`sentry.*.config.ts`) faz o cast de/pra o tipo `Event` do SDK. */
export function scrubSentryEvent(event: Record<string, unknown>): Record<string, unknown> {
  const scrubbed = { ...event };

  if (scrubbed.request && typeof scrubbed.request === "object") {
    const request = { ...(scrubbed.request as Record<string, unknown>) };
    delete request.cookies;
    if (request.headers && typeof request.headers === "object") {
      const headers = { ...(request.headers as Record<string, unknown>) };
      delete headers.authorization;
      delete headers.Authorization;
      delete headers.cookie;
      delete headers.Cookie;
      request.headers = headers;
    }
    if ("data" in request) request.data = scrubValue(request.data, 0);
    scrubbed.request = request;
  }

  if (scrubbed.extra) scrubbed.extra = scrubValue(scrubbed.extra, 0);
  if (scrubbed.contexts) scrubbed.contexts = scrubValue(scrubbed.contexts, 0);
  if (Array.isArray(scrubbed.breadcrumbs)) {
    scrubbed.breadcrumbs = scrubbed.breadcrumbs.map((crumb) =>
      crumb && typeof crumb === "object" && "data" in crumb ? { ...crumb, data: scrubValue((crumb as { data: unknown }).data, 0) } : crumb,
    );
  }

  // Nunca identifica o dono no Sentry — este app é de um usuário só (CLAUDE.md); um id/e-mail no evento não ajuda em nada e é dado pessoal exposto à toa.
  delete scrubbed.user;

  return scrubbed;
}
