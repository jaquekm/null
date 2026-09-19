"use server";

import { requireOwner } from "@/lib/auth";
import { listRecentItems, type BrowseItemRow } from "@/features/items/queries";

export async function getRecentItemsForPalette(): Promise<BrowseItemRow[]> {
  const { supabase } = await requireOwner();
  return listRecentItems(supabase, 8);
}
