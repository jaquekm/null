/**
 * IP privado/reservado (loopback, RFC1918, link-local, CGNAT, IPv6
 * equivalentes) — usado para bloquear SSRF ao buscar o `<title>` de uma URL
 * enviada pela captura (1.10).
 */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(".") && !ip.includes(":")) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
    const [a, b] = parts as [number, number, number, number];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("fe80")) return true;
    if (lower.startsWith("::ffff:")) return isPrivateIp(lower.slice("::ffff:".length));
    return false;
  }

  return true;
}
