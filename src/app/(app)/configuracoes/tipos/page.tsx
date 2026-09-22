import Link from "next/link";
import { NewTypeButton } from "@/features/types/components/new-type-button";
import { listObjectTypesWithCounts } from "@/features/types/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

export default async function TiposPage() {
  const { supabase } = await requireOwner();
  const [types, spaces] = await Promise.all([listObjectTypesWithCounts(supabase), listActiveSpaces(supabase)]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Tipos de objeto</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/configuracoes/tipos/exportar"
            className="rounded-lg border border-black/[.12] px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]"
          >
            Exportar como pack
          </Link>
          <NewTypeButton spaces={spaces} />
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {types.map((type) => (
          <li key={type.id}>
            <Link
              href={`/configuracoes/tipos/${type.slug}`}
              className="flex items-center justify-between rounded-lg border border-black/[.08] px-4 py-3 text-sm transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:hover:bg-white/[.06]"
            >
              <span className="flex items-center gap-2 text-black dark:text-zinc-50">
                <span>{type.icon || "•"}</span>
                {type.name}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {type.spaceName ?? "Todos"} · {type.itemCount} {type.itemCount === 1 ? "item" : "itens"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
