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
import { GripVertical, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { reorderFields, removeField } from "../actions";
import type { FieldDefinition } from "../schemas";
import { FieldForm } from "./field-form";

export function FieldList({
  typeId,
  fields,
  otherTypes,
}: {
  typeId: string;
  fields: FieldDefinition[];
  otherTypes: { id: string; name: string }[];
}) {
  const [items, setItems] = useState(fields);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((f) => f.key === active.id);
    const newIndex = items.findIndex((f) => f.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    startTransition(() => {
      void reorderFields(
        typeId,
        reordered.map((f) => f.key),
      );
    });
  }

  function handleRemove(field: FieldDefinition) {
    if (!window.confirm(`Remover o campo "${field.label}"? Os valores já salvos nos itens ficarão ocultos.`)) return;
    setItems((current) => current.filter((f) => f.key !== field.key));
    startTransition(() => {
      void removeField(typeId, field.key);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((f) => f.key)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1.5">
            {items.map((field) =>
              editingKey === field.key ? (
                <li key={field.key}>
                  <FieldForm
                    typeId={typeId}
                    existingField={field}
                    otherTypes={otherTypes}
                    onCancel={() => setEditingKey(null)}
                    onSaved={() => {
                      setEditingKey(null);
                      setItems((current) => current.map((f) => (f.key === field.key ? { ...f, ...field } : f)));
                    }}
                  />
                </li>
              ) : (
                <FieldRow
                  key={field.key}
                  field={field}
                  onEdit={() => setEditingKey(field.key)}
                  onRemove={() => handleRemove(field)}
                />
              ),
            )}
          </ul>
        </SortableContext>
      </DndContext>

      {items.length === 0 && !adding && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Este tipo ainda não tem campos.</p>
      )}

      {adding ? (
        <FieldForm
          typeId={typeId}
          otherTypes={otherTypes}
          onCancel={() => setAdding(false)}
          onSaved={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-black/[.2] px-3 py-1.5 text-sm text-black/70 hover:bg-black/[.04] dark:border-white/[.24] dark:text-white/70 dark:hover:bg-white/[.06]"
        >
          <Plus className="h-4 w-4" />
          Adicionar campo
        </button>
      )}
    </div>
  );
}

function FieldRow({
  field,
  onEdit,
  onRemove,
}: {
  field: FieldDefinition;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.key });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 rounded-lg border border-black/[.08] px-2 py-2 dark:border-white/[.08]"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${field.label}`}
        className="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center text-zinc-300 dark:text-zinc-600"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-black dark:text-zinc-50">
          {field.label}
          {field.required && <span className="ml-1 text-red-500">*</span>}
        </p>
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          {field.type} · {field.key}
        </p>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg px-2.5 py-1 text-xs text-zinc-600 hover:bg-black/[.04] dark:text-zinc-300 dark:hover:bg-white/[.06]"
      >
        Editar
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
      >
        Remover
      </button>
    </li>
  );
}
