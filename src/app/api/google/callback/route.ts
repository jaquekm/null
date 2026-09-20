import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { listGoogleCalendars } from "@/lib/google/calendar";
import { exchangeAuthorizationCode, fetchGoogleUserEmail, GOOGLE_SCOPES } from "@/lib/google/oauth";
import { OAUTH_STATE_COOKIE, verifyOAuthStateCookie } from "@/lib/google/state-cookie";
import { enqueueJob } from "@/lib/jobs/enqueue";

const INTEGRATIONS_PATH = "/configuracoes/integracoes";
/** `job_schedules.interval_seconds` do `calendar_sync` (3.5) — "a cada 10 min", enunciado da fase 3. */
const CALENDAR_SYNC_INTERVAL_SECONDS = 10 * 60;

function redirectWithError(requestUrl: string, message: string) {
  const url = new URL(INTEGRATIONS_PATH, requestUrl);
  url.searchParams.set("erro", message);
  return NextResponse.redirect(url);
}

/**
 * `GET /api/google/callback` (3.4): valida `state` contra o cookie da 3.4,
 * troca o código pelos tokens, grava `google_connections` (tokens
 * criptografados, 3.2) e a lista de calendários — o principal já com
 * `sync_enabled=true`, os outros desligados por padrão (o dono liga em
 * `/configuracoes/integracoes`). Novos calendários entram com
 * `ignoreDuplicates` pra não sobrescrever a escolha do dono numa reconexão.
 */
export async function GET(request: Request) {
  const { user, supabase } = await requireOwner();
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const savedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  const googleError = url.searchParams.get("error");
  if (googleError) {
    return redirectWithError(request.url, `O Google recusou a conexão (${googleError}).`);
  }

  const stateParam = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!stateParam || !code) {
    return redirectWithError(request.url, "Resposta do Google incompleta.");
  }

  const verified = verifyOAuthStateCookie(savedState, stateParam);
  if (!verified) {
    return redirectWithError(request.url, "Sessão de conexão expirada ou inválida. Tente conectar de novo.");
  }

  let tokens;
  try {
    tokens = await exchangeAuthorizationCode({ code, codeVerifier: verified.codeVerifier });
  } catch {
    return redirectWithError(request.url, "Não foi possível trocar o código pelo token do Google.");
  }

  if (!tokens.refreshToken) {
    return redirectWithError(
      request.url,
      "O Google não devolveu permissão de acesso contínuo. Remova o acesso do Hub em myaccount.google.com/permissions e tente conectar de novo.",
    );
  }

  let googleEmail: string;
  try {
    googleEmail = await fetchGoogleUserEmail(tokens.accessToken);
  } catch {
    return redirectWithError(request.url, "Não foi possível identificar a conta Google.");
  }

  const { data: connection, error: upsertError } = await supabase
    .from("google_connections")
    .upsert(
      {
        owner_id: user.id,
        google_email: googleEmail,
        refresh_token_encrypted: encrypt(tokens.refreshToken),
        access_token_encrypted: encrypt(tokens.accessToken),
        access_token_expires_at: new Date(Date.now() + tokens.expiresInSeconds * 1000).toISOString(),
        scopes: GOOGLE_SCOPES,
        status: "active",
        last_error: null,
      },
      { onConflict: "owner_id,google_email" },
    )
    .select("id")
    .single();

  if (upsertError || !connection) {
    return redirectWithError(request.url, "Não foi possível salvar a conexão com o Google.");
  }

  // Só faz sentido existir a partir da primeira conexão — `onConflict: "kind"`
  // faz isso ser um no-op nas reconexões seguintes (3.5).
  await supabase.from("job_schedules").upsert(
    { kind: "calendar_sync", owner_id: user.id, interval_seconds: CALENDAR_SYNC_INTERVAL_SECONDS, enabled: true },
    { onConflict: "kind" },
  );

  try {
    const calendars = await listGoogleCalendars(tokens.accessToken);
    if (calendars.length > 0) {
      await supabase.from("calendars").upsert(
        calendars.map((calendar) => ({
          owner_id: user.id,
          connection_id: connection.id,
          external_id: calendar.id,
          name: calendar.summary,
          color: calendar.backgroundColor,
          timezone: calendar.timeZone,
          is_primary: calendar.primary,
          sync_enabled: calendar.primary,
        })),
        { onConflict: "connection_id,external_id", ignoreDuplicates: true },
      );
    }
  } catch {
    // A conexão já foi salva; a lista de calendários pode ser recarregada
    // depois (botão "Sincronizar agora", 3.5) — não bloqueia o fluxo.
  }

  await enqueueJob({ ownerId: user.id, kind: "calendar_sync" });

  return NextResponse.redirect(new URL(INTEGRATIONS_PATH, request.url));
}
