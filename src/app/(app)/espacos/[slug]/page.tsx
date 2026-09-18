import Link from "next/link";
import { notFound } from "next/navigation";
import { NewItemButton } from "@/features/spaces/components/new-item-button";
import { SpaceSettingsForm } from "@/features/spaces/components/space-settings-form";
import {
  getSpaceBySlug,
  listOtherActiveSpaces,
  listSpaceItems,
  listSpaceObjectTypes,
} from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

export default async function SpacePage(props: PageProps<"/espacos/[slug]">) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const typeId = typeof searchParams.tipo === "string" ? searchParams.tipo : undefined;

  const { supabase } = await requireOwner();
  const space = await getSpaceBySlug(supabase, slug);
  if (!space) notFound();

  const [types, items, otherSpaces] = await Promise.all([
    listSpaceObjectTypes(supabase, space.id),
    listSpaceItems(supabase, space.id, { typeId }),
    listOtherActiveSpaces(supabase, space.id),
  ]);

  const linkClass = (isActive: boolean) =>
    `rounded-full px-3 py-1 ${
      isActive
        ? "bg-black/[.06] font-medium text-black dark:bg-white/[.1] dark:text-zinc-50"
        : "text-zinc-500 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
    }`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-black dark:text-zinc-50">
            <span>{space.icon || "•"}</span>
            {space.name}
            {space.archived_at && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                Arquivado
              </span>
            )}
          </h1>
          {space.description && (
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">{space.description}</p>
          )}
        </div>
        <NewItemButton spaceId={space.id} types={types} />
      </header>

      {types.length > 0 && (
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href={`/espacos/${space.slug}`} className={linkClass(!typeId)}>
            Todos
          </Link>
          {types.map((type) => (
            <Link key={type.id} href={`/espacos/${space.slug}?tipo=${type.id}`} className={linkClass(typeId === type.id)}>
              {type.name}
            </Link>
          ))}
        </nav>
      )}

      <ul className="flex flex-col gap-1">
        {items.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhum item aqui ainda.</p>
        )}
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/itens/${item.id}`}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.06]"
            >
              <span className="truncate text-black dark:text-zinc-50">{item.title || "Sem título"}</span>
              <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                {new Date(item.updated_at).toLocaleDateString("pt-BR")}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <SpaceSettingsForm
        space={{
          id: space.id,
          name: space.name,
          icon: space.icon,
          color: space.color,
          description: space.description,
          archived_at: space.archived_at,
        }}
        otherSpaces={otherSpaces}
      />
    </div>
  );
}
