import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/**
 * "OCR automático ligado/desligado" (2.9) — fica em `user_settings.preferences.autoOcr`,
 * não em `modules` (que liga/desliga a IA como um todo). Padrão ligado: só
 * desliga se o dono explicitamente marcar `false`.
 */
export async function isAutoOcrEnabled(supabase: Client, ownerId: string): Promise<boolean> {
  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle();
  const preferences = (data?.preferences as Record<string, unknown> | null) ?? {};
  return preferences.autoOcr !== false;
}

export interface MeetingNotesSettings {
  enabled: boolean;
  minutesBefore: number;
}

const DEFAULT_MEETING_NOTES_MINUTES_BEFORE = 15;

/**
 * "Criar notas de reunião automaticamente X minutos antes" (3.7) — desligado
 * por padrão (diferente do OCR automático: aqui o dono precisa optar,
 * `job prepare_meeting_notes` só age em quem ligou).
 */
export async function getMeetingNotesSettings(supabase: Client, ownerId: string): Promise<MeetingNotesSettings> {
  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle();
  const preferences = (data?.preferences as Record<string, unknown> | null) ?? {};
  const minutesBefore = Number(preferences.meetingNotesMinutesBefore);
  return {
    enabled: preferences.autoCreateMeetingNotes === true,
    minutesBefore: Number.isFinite(minutesBefore) && minutesBefore > 0 ? minutesBefore : DEFAULT_MEETING_NOTES_MINUTES_BEFORE,
  };
}

/**
 * "Notificações para o dono (configuráveis)" (3.9): `remindersPersonal` e
 * `shareComments` ainda não são checadas em nenhum fluxo de envio de
 * verdade (a primeira exigiria mexer no despacho de lembretes da 3.8, a
 * segunda depende de `share_comments`, que só nasce na 3.11) — guardadas
 * desde já pra não pedir de novo ao dono quando esses fluxos existirem.
 * `googleReconnect` (3.4) e `jobFailures` (2.2) já disparam push de
 * verdade. "Contas vencendo" fica pra fase 4. Todas ligadas por padrão.
 */
export interface OwnerNotificationPreferences {
  remindersPersonal: boolean;
  shareComments: boolean;
  jobFailures: boolean;
  googleReconnect: boolean;
}

const DEFAULT_OWNER_NOTIFICATIONS: OwnerNotificationPreferences = {
  remindersPersonal: true,
  shareComments: true,
  jobFailures: true,
  googleReconnect: true,
};

export async function getOwnerNotificationPreferences(supabase: Client, ownerId: string): Promise<OwnerNotificationPreferences> {
  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle();
  const preferences = (data?.preferences as Record<string, unknown> | null) ?? {};
  const stored = (preferences.ownerNotifications as Partial<OwnerNotificationPreferences> | undefined) ?? {};
  return { ...DEFAULT_OWNER_NOTIFICATIONS, ...stored };
}
