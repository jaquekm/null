"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import type { AgendaEntry } from "../lib/agenda-entry";

function itemIdFromTaskEntryId(entryId: string): string | null {
  // formato "item:<itemId>:<fieldKey>" (extractItemDateEntries)
  const parts = entryId.split(":");
  return parts.length >= 2 ? parts[1]! : null;
}

function TaskCard({ task, overdue }: { task: AgendaEntry; overdue: boolean }) {
  const itemId = itemIdFromTaskEntryId(task.id);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task:${task.id}`,
    disabled: !itemId,
    data: { itemId, title: task.title },
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10 } : undefined}
      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm ${
        overdue ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30" : "border-black/[.08] dark:border-white/[.08]"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <button type="button" {...attributes} {...listeners} aria-label={`Arrastar ${task.title}`} className="shrink-0 cursor-grab text-zinc-300 dark:text-zinc-600">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {task.href ? (
        <Link href={task.href} className="min-w-0 flex-1 truncate">
          {task.title}
        </Link>
      ) : (
        <span className="min-w-0 flex-1 truncate">{task.title}</span>
      )}
    </div>
  );
}

/** Tarefas atrasadas + do dia (3.6) — arrastáveis pra `TodayTimeline` (cria bloco de tempo). */
export function TodayTaskList({ overdueTasks, dueTodayTasks }: { overdueTasks: AgendaEntry[]; dueTodayTasks: AgendaEntry[] }) {
  if (overdueTasks.length === 0 && dueTodayTasks.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma tarefa atrasada ou com prazo hoje.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {overdueTasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium text-red-600 dark:text-red-400">Atrasadas</h3>
          {overdueTasks.map((task) => (
            <TaskCard key={task.id} task={task} overdue />
          ))}
        </div>
      )}
      {dueTodayTasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Hoje</h3>
          {dueTodayTasks.map((task) => (
            <TaskCard key={task.id} task={task} overdue={false} />
          ))}
        </div>
      )}
    </div>
  );
}
