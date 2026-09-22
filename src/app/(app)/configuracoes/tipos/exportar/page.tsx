import { ExportPackForm } from "@/features/packs/components/export-pack-form";
import { listExportableAutomations, listExportableTypes, listExportableViews } from "@/features/packs/queries";
import { requireOwner } from "@/lib/auth";

export default async function ExportarPackPage() {
  const { supabase, user } = await requireOwner();
  const [types, views, automations] = await Promise.all([
    listExportableTypes(supabase, user.id),
    listExportableViews(supabase, user.id),
    listExportableAutomations(supabase, user.id),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Exportar como pack</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Selecione tipos, visões e automações e baixe um JSON no formato de pack (5.2) — pra backup ou pra reinstalar em outro espaço.
      </p>
      <ExportPackForm types={types} views={views} automations={automations} />
    </div>
  );
}
