import { notFound } from "next/navigation";
import { NewCanvasButton } from "@/features/canvas/components/new-canvas-button";
import { DocumentsToReviewPanel } from "@/features/spaces/components/documents-to-review-panel";
import { NewItemButton } from "@/features/spaces/components/new-item-button";
import { SpaceBrowser } from "@/features/spaces/components/space-browser";
import { filtersFromSearchParams } from "@/features/spaces/lib/space-browser";
import { listOwnerTypeSlugs } from "@/features/templates/queries";
import { SpaceSettingsForm } from "@/features/spaces/components/space-settings-form";
import { getSpaceBySlug, listDocumentsToReview, listOtherActiveSpaces, listSpaceBrowserItems, listSpaceObjectTypes } from "@/features/spaces/queries";
import { ViewSwitcher } from "@/features/views/components/view-switcher";
import { listViews } from "@/features/views/queries";
import { getUserTimezone } from "@/features/reminders/queries";
import { requireOwner } from "@/lib/auth";
import { todayInTimezone } from "@/lib/dates";

export default async function SpacePage(props: PageProps<"/espacos/[slug]">) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const typeId = typeof searchParams.tipo === "string" ? searchParams.tipo : undefined;

  const { supabase, user } = await requireOwner();
  const space = await getSpaceBySlug(supabase, slug);
  if (!space) notFound();

  const todayDateStr = todayInTimezone(await getUserTimezone(supabase, user.id));
  const [types, otherSpaces, views, documentsToReview, browserItems, typeSlugs] = await Promise.all([
    listSpaceObjectTypes(supabase, space.id),
    listOtherActiveSpaces(supabase, space.id),
    listViews(supabase, space.id, typeId ?? null),
    listDocumentsToReview(supabase, user.id, space.id, todayDateStr),
    listSpaceBrowserItems(supabase, space.id),
    listOwnerTypeSlugs(supabase),
  ]);
  const subcategories = [...new Set(browserItems.flatMap((item) => item.tags.map((tag) => tag.name)))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-black dark:text-zinc-50">
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
          <NewItemButton spaceId={space.id} types={types} defaultTypeId={typeId} typeSlugs={typeSlugs} subcategories={subcategories} />
        </div>
      </header>

      <DocumentsToReviewPanel documents={documentsToReview} />

      <SpaceBrowser spaceSlug={space.slug} items={browserItems} initialFilters={filtersFromSearchParams(searchParams)} />

      {/* Visões salvas (tabela, kanban, calendário…) continuam existindo, mas recolhidas: o dia a dia é a busca com filtros acima. */}
      <details className="group rounded-2xl border border-black/[.06] bg-surface p-4 shadow-sm dark:border-white/[.06]">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700 select-none dark:text-zinc-200">
          Visões avançadas <span className="font-normal text-zinc-500 dark:text-zinc-400">— tabela, kanban, calendário, galeria</span>
        </summary>
        <div className="mt-4">
          {/* `key` força remontar ao trocar de tipo ou espaço — sem isso o estado interno da visão ficava preso na anterior. */}
          <ViewSwitcher key={`${space.id}:${typeId ?? "all"}`} spaceId={space.id} typeId={typeId ?? null} initialViews={views} />
        </div>
      </details>

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
