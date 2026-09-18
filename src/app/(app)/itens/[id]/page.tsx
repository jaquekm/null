import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";

/**
 * Página mínima de item: só o suficiente para o botão "Novo" da tarefa 1.4
 * ter para onde ir. O editor completo (Tiptap, propriedades, autosave,
 * backlinks, anexos) é a tarefa 1.6/1.7 — isto será substituído lá.
 */
export default async function ItemPage(props: PageProps<"/itens/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireOwner();

  const { data: item } = await supabase
    .from("items")
    .select("id, title, status, updated_at, created_at, spaces(name, slug), object_types(name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!item) notFound();

  const space = item.spaces;
  const type = item.object_types;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      {space && (
        <Link href={`/espacos/${space.slug}`} className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          ← {space.name}
        </Link>
      )}

      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{item.title || "Sem título"}</h1>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
        <div className="flex gap-1">
          <dt className="font-medium">Tipo:</dt>
          <dd>{type?.name ?? "Nenhum"}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">Status:</dt>
          <dd>{item.status}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">Atualizado:</dt>
          <dd>{new Date(item.updated_at).toLocaleString("pt-BR")}</dd>
        </div>
      </dl>

      <p className="rounded-lg border border-dashed border-black/[.12] p-4 text-sm text-zinc-500 dark:border-white/[.16] dark:text-zinc-400">
        O editor completo (corpo, propriedades, anexos, versões) chega nas próximas tarefas da fase 1.
      </p>
    </div>
  );
}
