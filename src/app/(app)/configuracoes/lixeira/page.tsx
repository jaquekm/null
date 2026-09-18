import { TrashList } from "@/features/items/components/trash-list";
import { listTrashedItems } from "@/features/items/queries";
import { requireOwner } from "@/lib/auth";

export default async function LixeiraPage() {
  const { supabase } = await requireOwner();
  const items = await listTrashedItems(supabase);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Lixeira</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Itens excluídos ficam aqui até você restaurar ou excluir definitivamente. A limpeza automática depois de 30
          dias chega na fase 2.
        </p>
      </div>
      <TrashList items={items} />
    </div>
  );
}
