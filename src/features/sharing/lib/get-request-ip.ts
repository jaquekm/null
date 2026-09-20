import "server-only";
import { headers } from "next/headers";

/** IP de quem está vendo (3.11: rate limit e `share_link_views.ip_hash`) — Vercel/proxies preenchem `x-forwarded-for`. */
export async function getRequestIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
