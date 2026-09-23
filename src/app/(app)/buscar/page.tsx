import { SearchWorkspace } from "@/features/search/components/search-workspace";
import { listObjectTypesForPicker, listPinnedItems, listRecentItems } from "@/features/items/queries";
import { isAiModuleEnabled } from "@/features/settings/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { listAllTags } from "@/features/tags/queries";
import { requireOwner } from "@/lib/auth";

export default async function BuscarPage() {
  const { supabase, user } = await requireOwner();

  const [spaces, types, tags, pinned, recent, aiEnabled] = await Promise.all([
    listActiveSpaces(supabase),
    listObjectTypesForPicker(supabase),
    listAllTags(supabase),
    listPinnedItems(supabase),
    listRecentItems(supabase),
    isAiModuleEnabled(supabase, user.id),
  ]);

  return <SearchWorkspace spaces={spaces} types={types} tags={tags} pinned={pinned} recent={recent} aiEnabled={aiEnabled} />;
}
