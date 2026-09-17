const PUBLIC_PATHS = [
  "/login",
  "/api/health",
  "/api/webhooks",
  "/api/jobs/tick",
  "/api/capture",
  "/api/mcp",
  "/manifest.webmanifest",
  "/sw.js",
];

/** Rotas que respondem sem sessão: usada pelo proxy (src/proxy.ts) para decidir o redirecionamento. */
export function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/p/")) return true;
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
