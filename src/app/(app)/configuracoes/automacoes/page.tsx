import Link from "next/link";
import { AutomationList } from "@/features/automations/components/automation-list";
import { listAutomations } from "@/features/automations/queries";
import { requireOwner } from "@/lib/auth";

export default async function AutomacoesPage() {
  const { supabase, user } = await requireOwner();
  const automations = await listAutomations(supabase, user.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Automações</h1>
        <Link href="/configuracoes/automacoes/novo" className="bg-foreground text-background rounded-full px-4 py-2 text-sm font-medium">
          Nova automação
        </Link>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Quando algo acontece, faça algo automaticamente — sem código.</p>
      <AutomationList automations={automations} />
    </div>
  );
}
