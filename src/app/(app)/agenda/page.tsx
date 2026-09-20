import Link from "next/link";
import { AgendaCalendar } from "@/features/agenda/components/agenda-calendar";
import { getUserTimezone, listCalendarsForPicker } from "@/features/agenda/queries";
import { requireOwner } from "@/lib/auth";

export default async function AgendaPage() {
  const { supabase, user } = await requireOwner();
  const [calendars, timezone] = await Promise.all([listCalendarsForPicker(supabase, user.id), getUserTimezone(supabase, user.id)]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Agenda</h1>
        <Link href="/agenda/hoje" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          Planejador do dia →
        </Link>
      </div>

      {calendars.length === 0 && (
        <p className="rounded-lg border border-black/[.08] p-3 text-sm text-zinc-500 dark:border-white/[.08] dark:text-zinc-400">
          Nenhum calendário do Google conectado —{" "}
          <Link href="/configuracoes/integracoes" className="underline">
            conecte um
          </Link>{" "}
          pra criar eventos por aqui. Prazos de itens e lembretes continuam aparecendo normalmente.
        </p>
      )}

      <AgendaCalendar calendars={calendars} timezone={timezone} />
    </div>
  );
}
