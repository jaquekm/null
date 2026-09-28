import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { buildAuthorizationUrl } from "@/lib/google/oauth";
import { computeCodeChallengeS256, generateCodeVerifier, generateState } from "@/lib/google/pkce";
import { OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE_SECONDS, signOAuthStateCookie } from "@/lib/google/state-cookie";

/**
 * `GET /api/google/connect` (3.4): gera `state` + PKCE, guarda os dois num
 * cookie httpOnly assinado por 10 min e redireciona pro consentimento do
 * Google. `access_type=offline` + `prompt=consent` (em `buildAuthorizationUrl`)
 * garantem um `refresh_token` mesmo se o dono já tiver autorizado antes.
 */
export async function GET(request: Request) {
  await requireOwner();

  // Sem GOOGLE_CLIENT_ID/SECRET (ou chave de assinatura) configurados, isto
  // estourava e a tela mostrava um erro 500 genérico.
  let authorizationUrl: string;
  let stateCookie: string;

  try {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    authorizationUrl = buildAuthorizationUrl({ state, codeChallenge: computeCodeChallengeS256(codeVerifier) });
    stateCookie = signOAuthStateCookie({ state, codeVerifier });
  } catch {
    const url = new URL("/configuracoes/integracoes", request.url);
    url.searchParams.set("erro", "A integração com o Google ainda não está configurada no servidor (faltam GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel).");
    return NextResponse.redirect(url);
  }

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, stateCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  return NextResponse.redirect(authorizationUrl);
}
