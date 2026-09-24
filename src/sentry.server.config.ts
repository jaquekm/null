import * as Sentry from "@sentry/nextjs";
import { serverEnv } from "@/lib/env";
import { scrubSentryEvent } from "@/lib/observability/scrub-sentry-event";

/** Erros do servidor (route handlers, jobs, server actions) — 7.6. Sem `SENTRY_DSN` configurado, o SDK fica inicializado mas não manda nada a lugar nenhum (comportamento padrão do `@sentry/nextjs` com `dsn` vazio). */
Sentry.init({
  dsn: serverEnv.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend: (event) => scrubSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event,
});
