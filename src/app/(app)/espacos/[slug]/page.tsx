import { notFound } from "next/navigation";
import Link from "next/link";
import { NewCanvasButton } from "@/features/canvas/components/new-canvas-button";
import { DocumentsToReviewPanel } from "@/features/spaces/components/documents-to-review-panel";
import { NewItemButton } from "@/features/spaces/components/new-item-button";
import { SpaceSettingsForm } from "@/features/spaces/components/space-settings-form";
import { getSpaceBySlug, listDocumentsToReview, listOtherActiveSpaces, listSpaceObjectTypes } from "@/features/spaces/queries";
import { ViewSwitcher } from "@/features/views/components/view-switcher";
import { listViews } from "@/features/views/queries";
import { requireOwner } from "@/lib/auth";

export default async function SpacePage(props: PageProps<"/espacos/[slug]">) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const typeId = typeof searchParams.tipo === "string" ? searchParams.tipo : undefined;

  const { supabase, user } = await requireOwner();
  const space = await getSpaceBySlug(supabase, slug);
  if (!space) notFound();

  const todayDateStr = new Date().toISOString().slice(0, 10);
  const [types, otherSpaces, views, documentsToReview] = await Promise.all([
    listSpaceObjectTypes(supabase, space.id),
    listOtherActiveSpaces(supabase, space.id),
    listViews(supabase, space.id, typeId ?? null),
    listDocumentsToReview(supabase, user.id, space.id, todayDateStr),
  ]);

  const spaceSlug = space.slug;

  function buildHref(next: { tipo?: string }) {
    const params = new URLSearchParams();
    if (next.tipo) params.set("tipo", next.tipo);
    const query = params.toString();
    return `/espacos/${spaceSlug}${query ? `?${query}` : ""}`;
  }

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
        <div className="flex flex-wrap gap-2">
          <NewCanvasButton spaceId={space.id} />
          <NewItemButton spaceId={space.id} types={types} defaultTypeId={typeId} />
        </div>
      </header>

      <DocumentsToReviewPanel documents={documentsToReview} />

      {types.length > 0 && (
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href={buildHref({})} className={linkClass(!typeId)}>
            Todos
          </Link>
          {types.map((type) => (
            <Link key={type.id} href={buildHref({ tipo: type.id })} className={linkClass(typeId === type.id)}>
              {type.name}
            </Link>
          ))}
        </nav>
      )}

      <ViewSwitcher spaceId={space.id} typeId={typeId ?? null} initialViews={views} />

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
