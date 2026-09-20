"use client";

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createTimeBlockFromTask } from "../actions";
import type { AgendaEntry } from "../lib/agenda-entry";
import type { TimelineWindow } from "../lib/timeline-layout";
import { TodayTimeline, type TimelineEvent } from "./today-timeline";
import { TodayTaskList } from "./today-task-list";

export interface ReminderSummary {
  id: string;
  title: string;
  send_at: string;
}

export interface PinnedItemSummary {
  id: string;
  title: string;
}

export function TodayPlanner({
  dateStr,
  events,
  window,
  overdueTasks,
  dueTodayTasks,
  reminders,
  pinnedItems,
}: {
  dateStr: string;
  events: TimelineEvent[];
  window: TimelineWindow;
  overdueTasks: AgendaEntry[];
  dueTodayTasks: AgendaEntry[];
  reminders: ReminderSummary[];
  pinnedItems: PinnedItemSummary[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"timeline" | "tarefas">("timeline");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !String(over.id).startsWith("slot:")) return;
    const itemId = active.data.current?.itemId as string | undefined;
    const title = active.data.current?.title as string | undefined;
    if (!itemId || !title) return;

    const startMinutes = Number(String(over.id).slice("slot:".length));
    void createTimeBlockFromTask(itemId, title, startMinutes).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Bloco de tempo criado.");
      router.refresh();
    });
  }

  const totalTasks = overdueTasks.length + dueTodayTasks.length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Planejador do dia</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {dateStr.split("-").reverse().join("/")} — {events.length} reuniões, {totalTasks} tarefas
        </p>
      </div>

      <div className="flex gap-4 border-b border-black/[.08] text-sm md:hidden dark:border-white/[.08]">
        <button
          type="button"
          onClick={() => setTab("timeline")}
          className={`border-b-2 px-1 pb-2 ${tab === "timeline" ? "border-black font-medium dark:border-white" : "border-transparent text-zinc-500"}`}
        >
          Linha do tempo
        </button>
        <button
          type="button"
          onClick={() => setTab("tarefas")}
          className={`border-b-2 px-1 pb-2 ${tab === "tarefas" ? "border-black font-medium dark:border-white" : "border-transparent text-zinc-500"}`}
        >
          Tarefas
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <div className={tab === "timeline" ? "block" : "hidden md:block"}>
            <TodayTimeline events={events} window={window} />
          </div>

          <div className={`flex flex-col gap-5 ${tab === "tarefas" ? "block" : "hidden md:flex"}`}>
            <section>
              <h2 className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Tarefas</h2>
              <TodayTaskList overdueTasks={overdueTasks} dueTodayTasks={dueTodayTasks} />
            </section>

            {pinnedItems.length > 0 && (
              <section>
                <h2 className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Fixados</h2>
                <ul className="flex flex-col gap-1 text-sm">
                  {pinnedItems.map((item) => (
                    <li key={item.id} className="truncate">
                      <a href={`/itens/${item.id}`} className="hover:underline">
                        {item.title || "Sem título"}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {reminders.length > 0 && (
              <section>
                <h2 className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Lembretes de hoje</h2>
                <ul className="flex flex-col gap-1 text-sm">
                  {reminders.map((reminder) => (
                    <li key={reminder.id} className="truncate">
                      {reminder.title}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </DndContext>
    </div>
  );
}
