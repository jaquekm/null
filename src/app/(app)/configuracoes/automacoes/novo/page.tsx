import { AutomationEditorForm } from "@/features/automations/components/automation-editor-form";
import { listTypesWithFields } from "@/features/automations/queries";
import { getUserTimezone } from "@/features/reminders/queries";
import { getOwnerWhatsapp } from "@/features/settings/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

export default async function NovaAutomacaoPage() {
  const { supabase, user } = await requireOwner();
  const [spaces, types, timezone, ownerWhatsapp] = await Promise.all([
    listActiveSpaces(supabase),
    listTypesWithFields(supabase, user.id),
    getUserTimezone(supabase, user.id),
    getOwnerWhatsapp(supabase, user.id),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Nova automação</h1>
      <AutomationEditorForm
        spaces={spaces}
        types={types}
        timezone={timezone}
        whatsappAvailable={ownerWhatsapp !== null}
        initial={{
          name: "",
          description: null,
          enabled: true,
          spaceId: null,
          typeId: null,
          trigger: { type: "item_created" },
          conditions: [],
          actions: [{ type: "notify_me", title: "", body: "" }],
        }}
      />
    </div>
  );
}
