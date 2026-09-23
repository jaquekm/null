"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyExtractedTasks, previewExtractedTasks } from "@/features/ai/actions";
import type { ExtractedTask } from "@/features/ai/prompts/extract-tasks";

/** "Extrair tarefas" (6.8): revisão com checkbox por tarefa (mantida por padrão) antes de criar os itens Tarefa. */
export function ExtractTasksPanel({ itemId }: { itemId: string }) {
  const [tasks, setTasks] = useState<ExtractedTask[] | null>(null);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleGenerate() {
    startTransition(async () => {
      const result = await previewExtractedTasks(itemId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data.length === 0) {
        toast("Nenhuma tarefa encontrada neste item.");
        return;
      }
      setTasks(result.data);
      setChecked(result.data.map(() => true));
    });
  }

  function handleApply() {
    if (!tasks) return;
    const selected = tasks.filter((_, index) => checked[index]);
    if (selected.length === 0) return;

    startTransition(async () => {
      const result = await applyExtractedTasks(itemId, { tasks: selected });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.count === 1 ? "1 tarefa criada." : `${result.data.count} tarefas criadas.`);
      setTasks(null);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-2">
      {!tasks ? (
        <button type="button" onClick={handleGenerate} disabled={pending} className="self-start rounded-full border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
          {pending ? "Buscando…" : "Extrair tarefas com IA"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-black/[.08] p-3 dark:border-white/[.08]">
          <p className="text-sm font-medium text-black dark:text-zinc-50">Tarefas encontradas</p>
          <ul className="flex flex-col gap-1.5">
            {tasks.map((task, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked[index] ?? false}
                  onChange={(e) => setChecked((prev) => prev.map((value, i) => (i === index ? e.target.checked : value)))}
                  className="mt-1"
                />
                <span>
                  {task.descricao}
                  {task.prazo && <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">— prazo {task.prazo}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={handleApply} disabled={pending || checked.every((value) => !value)} className="rounded-full border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
              {pending ? "Criando…" : "Criar tarefas selecionadas"}
            </button>
            <button type="button" onClick={() => setTasks(null)} disabled={pending} className="rounded-full border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
