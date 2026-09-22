import { notFound } from "next/navigation";
import { AutomationEditorForm } from "@/features/automations/components/automation-editor-form";
import { RunHistory } from "@/features/automations/components/run-history";
import { TestAutomationPanel } from "@/features/automations/components/test-automation-panel";
import { getAutomation, listAutomationRuns, listTypesWithFields } from "@/features/automations/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

export default async function AutomacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireOwner();

  const [automation, spaces, types] = await Promise.all([
    getAutomation(supabase, user.id, id),
    listActiveSpaces(supabase),
    listTypesWithFields(supabase, user.id),
  ]);
  if (!automation) notFound();

  const runs = await listAutomationRuns(supabase, id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{automation.name || "Automação"}</h1>

      <AutomationEditorForm
        automationId={id}
        spaces={spaces}
        types={types}
        initial={{
          name: automation.name,
          description: automation.description,
          enabled: automation.enabled,
          spaceId: automation.spaceId,
          typeId: automation.typeId,
          trigger: automation.trigger,
          conditions: automation.conditions,
          actions: automation.actions,
        }}
      />

      <TestAutomationPanel automationId={id} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Histórico de execuções</h2>
        <RunHistory runs={runs} />
      </section>
    </div>
  );
}
