import { TagManagementList } from "@/features/tags/components/tag-management-list";
import { listTagsWithCounts } from "@/features/tags/queries";
import { requireOwner } from "@/lib/auth";

export default async function TagsPage() {
  const { supabase } = await requireOwner();
  const tags = await listTagsWithCounts(supabase);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Tags</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Renomeie, mescle duas tags ou exclua. Tags novas são criadas na hora de marcar um item (ou digitando
          #palavra no título).
        </p>
      </div>
      <TagManagementList tags={tags} />
    </div>
  );
}
