export interface ShareLinkActiveCheck {
  revokedAt: string | null;
  expiresAt: string | null;
}

/** Revogado ou expirado — as duas viram "inválido" igual a "não existe" (3.11: "mesma resposta para todos os casos"). */
export function isShareLinkActive(link: ShareLinkActiveCheck, now: Date = new Date()): boolean {
  if (link.revokedAt) return false;
  if (link.expiresAt && new Date(link.expiresAt).getTime() < now.getTime()) return false;
  return true;
}
