import { CalendarPlus, RotateCw } from "lucide-react";
import { CalendarRow } from "@/features/integrations/components/calendar-row";
import { DisconnectButton } from "@/features/integrations/components/disconnect-button";
import { SyncNowButton } from "@/features/integrations/components/sync-now-button";
import { listGoogleConnections } from "@/features/integrations/queries";
import { MeetingNotesToggle } from "@/features/settings/components/meeting-notes-toggle";
import { getMeetingNotesSettings } from "@/features/settings/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

export default async function IntegrationsSettingsPage(props: PageProps<"/configuracoes/integracoes">) {
  const { supabase, user } = await requireOwner();
  const searchParams = await props.searchParams;
  const erro = typeof searchParams.erro === "string" ? searchParams.erro : null;

  const [connections, spaces, meetingNotesSettings] = await Promise.all([
    listGoogleConnections(supabase),
    listActiveSpaces(supabase),
    getMeetingNotesSettings(supabase, user.id),
  ]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Integrações</h1>
          <p className="text-sm text-black/60 dark:text-white/60">Conexão com o Google Calendar.</p>
        </div>
        {connections.some((connection) => connection.status === "active") && <SyncNowButton />}
      </div>

      {erro && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {erro}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {connections.map((connection) => (
          <div key={connection.id} className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-black dark:text-zinc-50">{connection.googleEmail}</p>
                {connection.status === "revoked" ? (
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    Conexão revogada — reconecte pra voltar a sincronizar.
                    {connection.lastError && ` (${connection.lastError})`}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Conectado</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {connection.status === "revoked" && (
                  <a
                    href="/api/google/connect"
                    className="flex items-center gap-1.5 rounded-md border border-black/[.08] px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-50 dark:hover:bg-white/[.06]"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Reconectar
                  </a>
                )}
                <DisconnectButton connectionId={connection.id} googleEmail={connection.googleEmail} />
              </div>
            </div>

            {connection.calendars.length > 0 && (
              <div className="mt-3 divide-y divide-black/[.06] border-t border-black/[.06] dark:divide-white/[.06] dark:border-white/[.06]">
                {connection.calendars.map((calendar) => (
                  <CalendarRow key={calendar.id} calendar={calendar} spaces={spaces} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <a
        href="/api/google/connect"
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-black/[.15] px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.15] dark:text-zinc-50 dark:hover:bg-white/[.06]"
      >
        <CalendarPlus className="h-4 w-4" />
        Conectar Google Calendar
      </a>

      <MeetingNotesToggle initialEnabled={meetingNotesSettings.enabled} initialMinutesBefore={meetingNotesSettings.minutesBefore} />
    </div>
  );
}
