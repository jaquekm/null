import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/login/mfa",
    "/api/health",
    "/api/webhooks",
    "/api/webhooks/transcricao",
    "/api/jobs/tick",
    "/api/capture",
    "/api/mcp",
    "/manifest.webmanifest",
    "/sw.js",
    "/p/abc123",
    "/p/abc123/comentarios",
  ])("libera %s sem login", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/inbox",
    "/agenda",
    "/configuracoes/seguranca",
    "/api/private",
    "/pconfiguracoes",
  ])("exige login em %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});
