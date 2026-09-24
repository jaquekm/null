import * as Sentry from "@sentry/nextjs";

/** Next.js chama isto uma vez, na subida do processo — carrega a config do Sentry certa por runtime (7.6). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
