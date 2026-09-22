"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { positionBetween } from "../lib/position";
import { reorderSpace } from "../actions";
import type { SidebarSpace } from "../queries";

export function SpaceSidebarList({
  spaces,
  collapsed,
}: {
  spaces: SidebarSpace[];
  collapsed: boolean;
}) {
  const [items, setItems] = useState(spaces);
  // Ajusta o estado durante a renderização (não em useEffect) quando `spaces`
  // muda por fora (espaço criado/excluído/arquivado em outro lugar, que já
  // dispara `revalidatePath("/", "layout")`) — mesmo padrão de
  // `NewSpaceButton`: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  // Sem isto, a lista fica presa no valor do primeiro `mount` pra sempre —
  // um espaço excluído continua aparecendo aqui (link morto, 404 ao clicar)
  // e um espaço recém-criado não aparece até recarregar a página.
  const [prevSpaces, setPrevSpaces] = useState(spaces);
  if (spaces !== prevSpaces) {
    setPrevSpaces(spaces);
    setItems(spaces);
  }
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    const movedIndex = reordered.findIndex((s) => s.id === active.id);
    const before = reordered[movedIndex - 1] ?? null;
    const after = reordered[movedIndex + 1] ?? null;
    const position = positionBetween(before?.position ?? null, after?.position ?? null);

    setItems(reordered.map((s, i) => (i === movedIndex ? { ...s, position } : s)));

    startTransition(() => {
      void reorderSpace(active.id as string, before?.position ?? null, after?.position ?? null);
    });
  }

  if (items.length === 0) {
    return collapsed ? null : (
      <p className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-500">Nenhum espaço ainda.</p>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-0.5">
          {items.map((space) => (
            <SpaceSidebarRow key={space.id} space={space} collapsed={collapsed} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SpaceSidebarRow({ space, collapsed }: { space: SidebarSpace; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === `/espacos/${space.slug}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: space.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="group flex items-center"
    >
      {!collapsed && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reordenar ${space.name}`}
          className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-zinc-300 opacity-0 group-hover:opacity-100 dark:text-zinc-600"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <Link
        href={`/espacos/${space.slug}`}
        title={collapsed ? space.name : undefined}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
          active
            ? "bg-black/[.06] font-medium text-black dark:bg-white/[.1] dark:text-zinc-50"
            : "text-zinc-600 hover:bg-black/[.04] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[.06] dark:hover:text-zinc-50"
        }`}
      >
        <span className="shrink-0">{space.icon || "•"}</span>
        {!collapsed && <span className="truncate">{space.name}</span>}
      </Link>
    </li>
  );
}
