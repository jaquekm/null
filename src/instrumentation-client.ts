import * as Sentry from "@sentry/nextjs";
import { publicEnv } from "@/lib/env";
import { scrubSentryEvent } from "@/lib/observability/scrub-sentry-event";

/** Erros do navegador (7.6) — carregado automaticamente pelo Next.js (arquivo especial `instrumentation-client`). Amostragem de performance baixa (`tracesSampleRate`) — o pedido do enunciado é "taxa de amostragem baixa", não zero, pra ainda dar sinal sem gastar cota à toa. */
Sentry.init({
  dsn: publicEnv.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend: (event) => scrubSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event,
});
