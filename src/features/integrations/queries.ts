import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface ConnectionCalendar {
  id: string;
  externalId: string;
  name: string;
  color: string | null;
  isPrimary: boolean;
  syncEnabled: boolean;
  spaceId: string | null;
  lastSyncedAt: string | null;
}

export interface GoogleConnectionWithCalendars {
  id: string;
  googleEmail: string;
  status: string;
  lastError: string | null;
  createdAt: string;
  calendars: ConnectionCalendar[];
}

/** Conexões do dono com o Google Calendar e os calendários de cada uma (3.4), pra `/configuracoes/integracoes`. */
export async function listGoogleConnections(supabase: Client): Promise<GoogleConnectionWithCalendars[]> {
  const { data: connections, error } = await supabase
    .from("google_connections")
    .select("id, google_email, status, last_error, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (connections.length === 0) return [];

  const { data: calendars, error: calendarsError } = await supabase
    .from("calendars")
    .select("id, connection_id, external_id, name, color, is_primary, sync_enabled, space_id, last_synced_at")
    .in(
      "connection_id",
      connections.map((c) => c.id),
    )
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });
  if (calendarsError) throw calendarsError;

  return connections.map((connection) => ({
    id: connection.id,
    googleEmail: connection.google_email,
    status: connection.status,
    lastError: connection.last_error,
    createdAt: connection.created_at,
    calendars: calendars
      .filter((calendar) => calendar.connection_id === connection.id)
      .map((calendar) => ({
        id: calendar.id,
        externalId: calendar.external_id,
        name: calendar.name,
        color: calendar.color,
        isPrimary: calendar.is_primary,
        syncEnabled: calendar.sync_enabled,
        spaceId: calendar.space_id,
        lastSyncedAt: calendar.last_synced_at,
      })),
  }));
}
