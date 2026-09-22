"use client";

import { DndContext, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateItemProperty, reorderItem } from "@/features/items/actions";
import { formatBRL, sumCents } from "@/lib/money";
import { positionBetween } from "@/features/spaces/lib/position";
import type { FieldDefinition } from "@/features/types/schemas";
import { createItemInColumn } from "../actions";
import type { ViewItemRow } from "../queries";
import { formatPropertyValue } from "../lib/format-property-value";

const NO_VALUE_COLUMN = "__sem_valor__";
const initialFieldState = { ok: true as const, data: null };

/**
 * Kanban (1.15): agrupa por um campo `select`. Arrastar entre colunas
 * atualiza a propriedade (reaproveitando `updateItemProperty`, montando um
 * `FormData` na mão em vez de vir de um `<form>` de verdade — a action já é
 * uma função async comum, dá pra chamar direto do handler de drag); dentro
 * da coluna, atualiza `position` (`reorderItem`, mesmo padrão de
 * `reorderSpace`/`SpaceSidebarList` da 1.3). Estado das linhas fica só
 * aqui — outras visões (Lista/Tabela) buscam de novo ao trocar de aba.
 */
export function KanbanView({
  rows: initialRows,
  fields,
  groupField,
  spaceId,
  typeId,
  sumField,
}: {
  rows: ViewItemRow[];
  fields: FieldDefinition[];
  groupField: FieldDefinition;
  spaceId: string;
  typeId: string;
  /** Campo `money` somado no cabeçalho de cada coluna (5.6, "soma de valores por coluna") — genérico, opcional. */
  sumField?: FieldDefinition;
}) {
  const [rows, setRows] = useState(initialRows);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const cardFields = fields.filter((field) => field.showInCard && field.key !== groupField.key);
  const options = groupField.options ?? [];
  const columnIds = [...options.map((option) => option.id), NO_VALUE_COLUMN];

  function columnValue(row: ViewItemRow): string {
    const value = row.properties[groupField.key];
    return typeof value === "string" && value ? value : NO_VALUE_COLUMN;
  }

  function rowsForColumn(columnId: string): ViewItemRow[] {
    return rows.filter((row) => columnValue(row) === columnId).sort((a, b) => a.position - b.position);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const activeRow = rows.find((row) => row.id === activeId);
    if (!activeRow) return;

    const overId = String(over.id);
    const overColumnId = overId.startsWith("column:") ? overId.slice("column:".length) : null;
    const overRow = overColumnId ? null : rows.find((row) => row.id === overId);
    const targetColumnId = overColumnId ?? (overRow ? columnValue(overRow) : columnValue(activeRow));
    const targetValue = targetColumnId === NO_VALUE_COLUMN ? null : targetColumnId;

    const columnRows = rows
      .filter((row) => row.id !== activeId && columnValue(row) === targetColumnId)
      .sort((a, b) => a.position - b.position);

    let before: ViewItemRow | null = null;
    let after: ViewItemRow | null = null;
    if (overRow && overRow.id !== activeId) {
      const overIndex = columnRows.findIndex((row) => row.id === overRow.id);
      before = columnRows[overIndex - 1] ?? null;
      after = columnRows[overIndex] ?? null;
    } else {
      before = columnRows[columnRows.length - 1] ?? null;
    }

    const position = positionBetween(before?.position ?? null, after?.position ?? null);
    const sourceValue = (activeRow.properties[groupField.key] as string | undefined) ?? null;
    const changedColumn = sourceValue !== targetValue;

    setRows((current) =>
      current.map((row) =>
        row.id === activeId
          ? { ...row, position, properties: changedColumn ? { ...row.properties, [groupField.key]: targetValue } : row.properties }
          : row,
      ),
    );

    startTransition(async () => {
      if (changedColumn) {
        const formData = new FormData();
        formData.append("value", targetValue ?? "");
        const result = await updateItemProperty(activeId, groupField.key, activeRow.updatedAt, initialFieldState, formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (result.data) {
          setRows((current) => current.map((row) => (row.id === activeId ? { ...row, updatedAt: result.data!.updatedAt } : row)));
        }
      }

      const reorderResult = await reorderItem(activeId, before?.position ?? null, after?.position ?? null);
      if (!reorderResult.ok) toast.error(reorderResult.error);
    });
  }

  function handleCreated(columnId: string, item: ViewItemRow) {
    void columnId;
    setRows((current) => [...current, item]);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columnIds.map((columnId) => (
          <KanbanColumn
            key={columnId}
            columnId={columnId}
            title={columnId === NO_VALUE_COLUMN ? "Sem valor" : (options.find((o) => o.id === columnId)?.label ?? columnId)}
            rows={rowsForColumn(columnId)}
            cardFields={cardFields}
            spaceId={spaceId}
            typeId={typeId}
            groupField={groupField}
            sumField={sumField?.type === "money" ? sumField : undefined}
            onCreated={(item) => handleCreated(columnId, item)}
          />
        ))}
      </div>
    </DndContext>
  );
}

function KanbanColumn({
  columnId,
  title,
  rows,
  cardFields,
  spaceId,
  typeId,
  groupField,
  sumField,
  onCreated,
}: {
  columnId: string;
  title: string;
  rows: ViewItemRow[];
  cardFields: FieldDefinition[];
  spaceId: string;
  typeId: string;
  groupField: FieldDefinition;
  sumField?: FieldDefinition;
  onCreated: (item: ViewItemRow) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${columnId}` });
  const [adding, setAdding] = useState(false);
  const [title2, setTitle2] = useState("");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    const trimmed = title2.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await createItemInColumn({
        spaceId,
        typeId,
        title: trimmed,
        groupField: groupField.key,
        groupValue: columnId === NO_VALUE_COLUMN ? null : columnId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onCreated({
        id: result.data.id,
        title: result.data.title,
        status: "active",
        spaceId,
        typeId,
        properties: result.data.properties,
        updatedAt: result.data.updatedAt,
        createdAt: result.data.createdAt,
        position: result.data.position,
        tags: [],
        coverPath: null,
        content: null,
      });
      setTitle2("");
      setAdding(false);
    });
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col gap-2 rounded-lg border p-2 ${
        isOver ? "border-black/30 bg-black/[.02] dark:border-white/30 dark:bg-white/[.04]" : "border-black/[.08] dark:border-white/[.08]"
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{title}</h3>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{rows.length}</span>
      </div>
      {sumField && (
        <p className="px-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {formatBRL(sumCents(rows.map((row) => (typeof row.properties[sumField.key] === "number" ? (row.properties[sumField.key] as number) : 0))))}
        </p>
      )}

      <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <KanbanCard key={row.id} row={row} fields={cardFields} />
          ))}
        </div>
      </SortableContext>

      {adding ? (
        <div className="flex flex-col gap-1.5">
          <input
            autoFocus
            value={title2}
            onChange={(e) => setTitle2(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            disabled={pending}
            placeholder="Título do card"
            className="rounded-lg border border-black/[.12] bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || !title2.trim()}
              onClick={handleCreate}
              className="text-xs text-zinc-600 hover:underline disabled:opacity-60 dark:text-zinc-300"
            >
              {pending ? "Criando..." : "Criar"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-zinc-400 hover:underline dark:text-zinc-500">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-lg px-1 py-1 text-xs text-zinc-400 hover:bg-black/[.04] hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-white/[.06] dark:hover:text-zinc-300"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar card
        </button>
      )}
    </div>
  );
}

function KanbanCard({ row, fields }: { row: ViewItemRow; fields: FieldDefinition[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-start gap-1.5 rounded-lg border border-black/[.08] bg-white p-2 text-sm dark:border-white/[.08] dark:bg-zinc-950"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${row.title || "item sem título"}`}
        className="mt-0.5 shrink-0 cursor-grab text-zinc-300 dark:text-zinc-600"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Link href={`/itens/${row.id}`} className="min-w-0 flex-1">
        <p className="truncate text-black dark:text-zinc-50">{row.title || "Sem título"}</p>
        {fields.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-zinc-400 dark:text-zinc-500">
            {fields.map((field) => (
              <span key={field.key}>{formatPropertyValue(row.properties[field.key], field)}</span>
            ))}
          </div>
        )}
      </Link>
    </div>
  );
}
