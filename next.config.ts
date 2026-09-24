import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * CSP básica. Ao integrar um domínio externo que o navegador acessa
 * diretamente (ex.: Storage do Supabase, Google Calendar, futuras APIs),
 * adicione o domínio na diretiva correspondente (`img-src`, `connect-src`
 * etc.) em vez de afrouxar a política inteira.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "microphone=(self), camera=(), geolocation=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  experimental: {
    // Server action de upload da importação (7.5: .enex/.zip/.json) — maior que o padrão de 1MB.
    serverActions: { bodySizeLimit: "8mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Links públicos de compartilhamento: nunca vazar a URL para o site de destino.
        source: "/p/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

// `next.config.ts` roda fora do runtime da aplicação (antes/fora de `src/lib/env.ts`) — lido direto de `process.env`
// de propósito, não é "código da aplicação" pra fins da regra do CLAUDE.md (que exige ler variáveis só via `env.ts`).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // Build usa Turbopack (`next build`) — a instrumentação automática do plugin webpack do Sentry não se aplica
  // (aviso do próprio SDK); o que continua funcionando de verdade é o `Sentry.init()` em `src/instrumentation*.ts`.
});
