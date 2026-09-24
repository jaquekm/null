import Link from "next/link";
import { SeedManualButton } from "@/features/manual/components/seed-manual-button";
import { listManualItems } from "@/features/manual/queries";
import { requireOwner } from "@/lib/auth";

export default async function ManualPage() {
  const { supabase, user } = await requireOwner();
  const items = await listManualItems(supabase, user.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Manual do sistema</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Três documentos gerados dentro do próprio Hub (espaço &quot;Hub&quot;, tipo Documento): como usar o dia a dia, o que fazer quando algo dá errado, e
          onde está cada segredo — sem os valores.
        </p>
      </div>

      <SeedManualButton hasItems={items.length > 0} />

      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/itens/${item.id}`}
                className="block rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
