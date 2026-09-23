import { OrganizeInboxPanel } from "@/features/ai/components/organize-inbox-panel";
import { InboxWorkspace } from "@/features/items/components/inbox/inbox-workspace";
import { listInboxItems, listObjectTypesForPicker } from "@/features/items/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

export default async function InboxPage() {
  const { supabase } = await requireOwner();

  const [items, spaces, types] = await Promise.all([
    listInboxItems(supabase),
    listActiveSpaces(supabase),
    listObjectTypesForPicker(supabase),
  ]);

  return (
    <>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <OrganizeInboxPanel items={items} spaces={spaces} types={types} />
      </div>
      <InboxWorkspace items={items} spaces={spaces} types={types} />
    </>
  );
}
