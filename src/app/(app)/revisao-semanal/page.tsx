import Link from "next/link";
import { WeeklyReviewForm } from "@/features/weekly-review/components/weekly-review-form";
import { getWeeklyReviewData } from "@/features/weekly-review/queries";
import { formatBRL } from "@/lib/money";
import { requireOwner } from "@/lib/auth";

export default async function RevisaoSemanalPage() {
  const { supabase, user } = await requireOwner();
  const data = await getWeeklyReviewData(supabase, user.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Revisão semanal</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Passo a passo guiado (5.8) — ao concluir, salva um resumo como nota.</p>
      </div>

      <Step title="1. Zerar inbox" empty="Inbox zerada." count={data.inbox.length}>
        <ul className="flex flex-col gap-1">
          {data.inbox.map((item) => (
            <li key={item.id}>
              <Link href={`/itens/${item.id}`} className="text-sm text-black underline dark:text-zinc-50">
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </Step>

      <Step
        title="2. Projetos em andamento"
        empty={data.projectsInProgress === null ? "Pack Projetos não instalado." : "Nenhum projeto em andamento."}
        count={data.projectsInProgress?.length ?? 0}
      >
        <ul className="flex flex-col gap-1">
          {data.projectsInProgress?.map((project) => (
            <li key={project.id}>
              <Link href={`/itens/${project.id}`} className="text-sm text-black underline dark:text-zinc-50">
                {project.title}
              </Link>
            </li>
          ))}
        </ul>
      </Step>

      <Step title="3. Tarefas atrasadas" empty="Nenhuma tarefa atrasada." count={data.overdueTasks.length}>
        <ul className="flex flex-col gap-1">
          {data.overdueTasks.map((task) => (
            <li key={task.id}>
              <Link href={task.href ?? "#"} className="text-sm text-black underline dark:text-zinc-50">
                {task.title}
              </Link>
            </li>
          ))}
        </ul>
      </Step>

      <Step title="4. Agenda da próxima semana" empty="Sem compromissos na próxima semana." count={data.nextWeekAgenda.length}>
        <ul className="flex flex-col gap-1">
          {data.nextWeekAgenda.map((entry) => (
            <li key={entry.id} className="text-sm text-zinc-700 dark:text-zinc-200">
              {entry.title}
            </li>
          ))}
        </ul>
      </Step>

      <Step
        title="5. Contas da semana"
        empty={data.billsThisWeek === null ? "Módulo Finanças desligado." : "Nenhuma conta vencendo essa semana."}
        count={data.billsThisWeek?.length ?? 0}
      >
        <ul className="flex flex-col gap-1">
          {data.billsThisWeek?.map((bill) => (
            <li key={bill.id} className="text-sm text-zinc-700 dark:text-zinc-200">
              {bill.description} — {formatBRL(bill.amountCents)} (venc. {bill.dueOn})
            </li>
          ))}
        </ul>
      </Step>

      <section className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">6. Notas livres da semana</h2>
        <WeeklyReviewForm />
      </section>
    </div>
  );
}

function Step({ title, empty, count, children }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
      <h2 className="text-sm font-semibold text-black dark:text-zinc-50">{title}</h2>
      {count === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{empty}</p> : children}
    </section>
  );
}
