"use client";

import { CalendarDays, GanttChart, Images, LayoutGrid, List as ListIcon, Plus, Table as TableIcon, type LucideIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createView, deleteView, duplicateView, renameView, setDefaultView } from "../actions";
import type { ViewRow } from "../queries";
import { viewKinds, type ViewKind } from "../schemas";
import { ItemsView } from "./items-view";

const KIND_ICON: Record<ViewKind, LucideIcon> = {
  list: ListIcon,
  table: TableIcon,
  kanban: LayoutGrid,
  calendar: CalendarDays,
  timeline: GanttChart,
  gallery: Images,
};
const KIND_LABEL: Record<ViewKind, string> = {
  list: "Lista",
  table: "Tabela",
  kanban: "Kanban",
  calendar: "Calendário",
  timeline: "Linha do tempo",
  gallery: "Galeria",
};

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

/** Trocar/criar/renomear/duplicar/excluir/marcar padrão (1.15) — a página do espaço usa isto. */
export function ViewSwitcher({
  spaceId,
  typeId,
  initialViews,
}: {
  spaceId: string;
  typeId: string | null;
  initialViews: ViewRow[];
}) {
  const [views, setViews] = useState(initialViews);
  const [activeId, setActiveId] = useState<string | null>(
    initialViews.find((view) => view.isDefault)?.id ?? initialViews[0]?.id ?? null,
  );
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<ViewKind>("list");
  const [pending, startTransition] = useTransition();

  const activeView = views.find((view) => view.id === activeId) ?? null;

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createView({ spaceId, typeId, name, kind: newKind });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const created: ViewRow = {
        id: result.data.id,
        name: result.data.name,
        kind: result.data.kind,
        spaceId,
        typeId,
        config: { filters: [], sort: [] },
        isDefault: false,
        position: views.length,
      };
      setViews((current) => [...current, created]);
      setActiveId(created.id);
      setNewName("");
      setCreating(false);
    });
  }

  function handleRename(id: string) {
    const view = views.find((v) => v.id === id);
    if (!view) return;
    const name = window.prompt("Novo nome da visão", view.name);
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    startTransition(async () => {
      const result = await renameView(id, trimmed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setViews((current) => current.map((v) => (v.id === id ? { ...v, name: trimmed } : v)));
    });
  }

  function handleDuplicate(id: string) {
    const original = views.find((v) => v.id === id);
    startTransition(async () => {
      const result = await duplicateView(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const created: ViewRow = {
        id: result.data.id,
        name: result.data.name,
        kind: result.data.kind,
        spaceId,
        typeId,
        config: original?.config ?? { filters: [], sort: [] },
        isDefault: false,
        position: views.length,
      };
      setViews((current) => [...current, created]);
      setActiveId(created.id);
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Excluir esta visão?")) return;
    startTransition(async () => {
      const result = await deleteView(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setViews((current) => {
        const next = current.filter((v) => v.id !== id);
        if (activeId === id) setActiveId(next[0]?.id ?? null);
        return next;
      });
    });
  }

  function handleSetDefault(id: string) {
    startTransition(async () => {
      const result = await setDefaultView(id, spaceId, typeId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setViews((current) => current.map((v) => ({ ...v, isDefault: v.id === id })));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {views.map((view) => {
          const Icon = KIND_ICON[view.kind];
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => setActiveId(view.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                activeId === view.id
                  ? "bg-black/[.06] font-medium text-black dark:bg-white/[.1] dark:text-zinc-50"
                  : "text-zinc-500 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {view.name}
              {view.isDefault && <span className="text-amber-500">★</span>}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-zinc-500 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
        >
          <Plus className="h-3.5 w-3.5" /> Nova visão
        </button>
      </div>

      {creating && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-black/[.08] p-2 dark:border-white/[.08]">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Nome da visão"
            className={inputClassName}
          />
          <select
            aria-label="Tipo de visão"
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as ViewKind)}
            className={inputClassName}
          >
            {viewKinds.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABEL[kind]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !newName.trim()}
            onClick={handleCreate}
            className="bg-foreground text-background rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            Criar
          </button>
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            Cancelar
          </button>
        </div>
      )}

      {activeView && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <button type="button" onClick={() => handleRename(activeView.id)} className="hover:underline">
              Renomear
            </button>
            <button type="button" onClick={() => handleDuplicate(activeView.id)} className="hover:underline">
              Duplicar
            </button>
            {!activeView.isDefault && (
              <button type="button" onClick={() => handleSetDefault(activeView.id)} className="hover:underline">
                Marcar como padrão
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDelete(activeView.id)}
              className="text-red-600 hover:underline dark:text-red-400"
            >
              Excluir
            </button>
          </div>
          <ItemsView spaceId={spaceId} typeId={typeId ?? undefined} view={activeView} />
        </>
      )}

      {!activeView && (
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhuma visão ainda — crie uma acima.</p>
      )}
    </div>
  );
}
