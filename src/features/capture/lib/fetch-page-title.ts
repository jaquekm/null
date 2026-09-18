import "server-only";
import { lookup } from "node:dns/promises";
import { isPrivateIp } from "./is-private-ip";

const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 200_000;

/**
 * Busca o `<title>` de uma URL no servidor (1.10), com timeout de 5s,
 * limite de tamanho e bloqueio de IPs privados (SSRF) — resolve o DNS
 * primeiro e recusa endereços privados antes de fazer qualquer requisição,
 * e não segue redirecionamentos (poderiam apontar para um IP privado).
 */
export async function fetchPageTitle(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  try {
    const { address } = await lookup(parsed.hostname);
    if (isPrivateIp(address)) return null;
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "manual",
      headers: { "user-agent": "HubBot/1.0 (+captura)" },
    });
    if (!response.ok || !response.body) return null;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    let html = "";

    while (received < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      html += decoder.decode(value, { stream: true });
      if (/<\/title>/i.test(html)) break;
    }
    void reader.cancel().catch(() => {});

    const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
    const title = match?.[1]?.trim();
    return title ? title.slice(0, 500) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
