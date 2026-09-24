import * as Sentry from "@sentry/nextjs";
import { serverEnv } from "@/lib/env";
import { scrubSentryEvent } from "@/lib/observability/scrub-sentry-event";

/** Erros do runtime edge (`src/proxy.ts`) — 7.6. Mesmo `beforeSend` do servidor. */
Sentry.init({
  dsn: serverEnv.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend: (event) => scrubSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event,
});
