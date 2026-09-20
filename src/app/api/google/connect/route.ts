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
export async function GET() {
  await requireOwner();

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = computeCodeChallengeS256(codeVerifier);

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, signOAuthStateCookie({ state, codeVerifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  return NextResponse.redirect(buildAuthorizationUrl({ state, codeChallenge }));
}
