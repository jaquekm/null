import { PageHelp } from "@/components/shared/page-help";
import { AlarmClock, CalendarClock, CalendarDays, Link2, CheckCircle2, Clock3, Droplet, Dumbbell, Flame, Hourglass, Inbox, ListTodo, Pill, Receipt, Stethoscope, UtensilsCrossed, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FastingCard } from "@/features/fasting/components/fasting-card";
import type { FastingData } from "@/features/fasting/queries";
import { TodayHabitsCard, type TodayHabit } from "@/features/habits/components/today-habits-card";
import { MealsCard } from "@/features/meals/components/meals-card";
import type { MealsState } from "@/features/meals/lib/meal-slots";
import { MedicationsCard } from "@/features/medications/components/medications-card";
import type { MedicationForToday } from "@/features/medications/queries";
import { QuickLogWorkoutButton } from "@/features/treinos/components/quick-log-workout-button";
import { WaterCard } from "@/features/water/components/water-card";
import type { WaterData } from "@/features/water/queries";
import { MarkLinkActivitySeen } from "@/features/sharing/components/mark-link-activity-seen";
import { TodayCapture } from "./today-capture";

export interface TodayRow {
  id: string;
  title: string;
  href: string | null;
  /** Hora ("09:30"), "dia todo"… à esquerda. */
  lead?: string;
  /** "atrasado", "vence hoje"… à direita. */
  meta?: string;
  danger?: boolean;
}

export interface TodayViewProps {
  dateLabel: string;
  hello: string;
  summary: string;
  agenda: TodayRow[];
  reminders: TodayRow[];
  tasks: TodayRow[];
  /** Quantos prazos ficaram de fora da lista (o "e mais…"). */
  hiddenTasks: number;
  bills: TodayRow[];
  /** Documentos vencendo ou vencidos há pouco (9.5) — vazio = o cartão nem aparece. */
  expiring?: TodayRow[];
  /** Comentários e marcações não vistos nos links da dona (9.7) — vazio = o cartão nem aparece. */
  linkActivity?: TodayRow[];
  hiddenLinkActivity?: number;
  /** `null` = sem programa de treino ativo (o cartão nem aparece). `programId`/`week` só importam pra "Marquei, sem detalhar" (10.8). */
  workout: { done: boolean; letter: string; name: string | null; programId: string; week: number } | null;
  recent: TodayRow[];
  inboxCount: number;
  /** Data de hoje (yyyy-MM-dd) — só pro "Marquei, sem detalhar" do treino e pro toggle de hábitos (10.8). */
  todayDateStr: string;
  /** Hábitos do dia (10.8): só os agendados pra hoje, marcáveis sem abrir a Rotina. `hasHabitType=false` esconde o card. */
  habits: { hasHabitType: boolean; today: TodayHabit[] };
  /** Refeições marcáveis (10.8) — "comi ou não", sem detalhar o quê (isso é o cardápio, 10.9). */
  meals: MealsState;
  /** Rotina por horário (10.2): "Agora: Academia (8h–9h) · Depois: 13h Almoço". `null`/ausente = sem blocos hoje. */
  routine?: { current: string | null; next: string | null } | null;
  /** Água (10.4): meta, total de hoje e histórico dos últimos 7 dias. */
  water: WaterData;
  /** Remédios e vitaminas (10.5): nome, dose, horários e estoque. */
  medications: MedicationForToday[];
  /** Log médico (10.7): `hasAny=false` (pack não instalado ainda) esconde o card por inteiro. */
  medical: { hasAny: boolean; spaceHref: string | null; nextConsultaLabel: string | null };
  /** Jejum (10.11): sessão ativa (se tiver) e histórico recente. */
  fasting: FastingData;
}

function Card({ icon: Icon, title, href, linkLabel, children }: { icon: LucideIcon; title: string; href?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-black/[.06] bg-surface p-5 shadow-sm dark:border-white/[.06]">
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-black dark:text-zinc-50">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand-text">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          {title}
        </h2>
        {href && (
          <Link href={href} className="text-xs font-medium text-zinc-500 hover:text-brand-text dark:text-zinc-400">
            {linkLabel ?? "Ver tudo"} →
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-surface-muted px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">{children}</p>;
}

function Rows({ rows, empty, more }: { rows: TodayRow[]; empty: string; more?: number }) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="flex flex-col">
      {rows.map((row) => {
        const body = (
          <>
            {row.lead && <span className="w-14 shrink-0 text-xs font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">{row.lead}</span>}
            <span className="min-w-0 flex-1 truncate text-sm text-black dark:text-zinc-100">{row.title || "Sem título"}</span>
            {row.meta && (
              <span className={`shrink-0 text-xs ${row.danger ? "font-medium text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}>{row.meta}</span>
            )}
          </>
        );
        const className = "-mx-2 flex items-center gap-3 rounded-lg px-2 py-2";
        return (
          <li key={row.id}>
            {row.href ? (
              <Link href={row.href} className={`${className} hover:bg-black/[.03] dark:hover:bg-white/[.04]`}>
                {body}
              </Link>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        );
      })}
      {more ? <li className="pt-1 text-xs text-zinc-500 dark:text-zinc-400">e mais {more}…</li> : null}
    </ul>
  );
}

/**
 * Página inicial "Hoje" (pedido da dona): o dia numa tela só — compromissos,
 * lembretes, prazos, contas vencendo, treino, Inbox e o que foi aberto por
 * último, com a captura rápida no topo. Só apresentação: quem busca e monta
 * os dados é `app/(app)/hoje/page.tsx`.
 */
export function TodayView(props: TodayViewProps) {
  const { workout } = props;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-brand-text first-letter:uppercase">{props.dateLabel}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl dark:text-zinc-50">{props.hello}!</h1>
          <PageHelp topic="hoje" />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{props.summary}</p>
        {props.routine && (props.routine.current || props.routine.next) && (
          <Link
            href="/rotina?ver=horarios"
            className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 self-start rounded-2xl bg-teal-50 px-3 py-1 text-sm text-teal-900 hover:opacity-90 dark:bg-teal-950 dark:text-teal-100"
          >
            <Clock3 className="h-4 w-4" aria-hidden />
            {props.routine.current && (
              <span>
                <strong>Agora:</strong> {props.routine.current}
              </span>
            )}
            {props.routine.current && props.routine.next && <span aria-hidden>·</span>}
            {props.routine.next && (
              <span>
                <strong>Depois:</strong> {props.routine.next}
              </span>
            )}
          </Link>
        )}
      </header>

      <TodayCapture />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card icon={CalendarDays} title="Agenda de hoje" href="/agenda/hoje" linkLabel="Planejar o dia">
          <Rows rows={props.agenda} empty="Nenhum compromisso hoje." />
        </Card>

        <Card icon={AlarmClock} title="Lembretes de hoje" href="/lembretes">
          <Rows rows={props.reminders} empty="Nenhum lembrete marcado pra hoje." />
        </Card>

        <Card icon={ListTodo} title="Prazos" href="/agenda/hoje">
          <Rows rows={props.tasks} empty="Nada vencendo hoje. 🎉" more={props.hiddenTasks} />
        </Card>

        <Card icon={Receipt} title="Contas a pagar" href="/financas/contas" linkLabel="Contas">
          <Rows rows={props.bills} empty="Nenhuma conta vencendo nos próximos 7 dias." />
        </Card>

        {props.linkActivity && props.linkActivity.length > 0 && (
          <Card icon={Link2} title="Nos seus links" href="/configuracoes/compartilhamentos" linkLabel="Links">
            <Rows rows={props.linkActivity} empty="" more={props.hiddenLinkActivity} />
            <MarkLinkActivitySeen />
          </Card>
        )}

        {props.expiring && props.expiring.length > 0 && (
          <Card icon={CalendarClock} title="Vencendo">
            <Rows rows={props.expiring} empty="" />
          </Card>
        )}

        <Card icon={Droplet} title="Água">
          <WaterCard goalMl={props.water.goalMl} todayMl={props.water.todayMl} history={props.water.history} />
        </Card>

        <Card icon={Pill} title="Remédios">
          <MedicationsCard medications={props.medications} />
        </Card>

        <Card icon={Hourglass} title="Jejum">
          <FastingCard active={props.fasting.active} history={props.fasting.history} averageMinutes={props.fasting.averageMinutes} />
        </Card>

        {props.habits.hasHabitType && (
          <Card icon={Flame} title="Hábitos" href="/rotina" linkLabel="Ver semana">
            <TodayHabitsCard habits={props.habits.today} today={props.todayDateStr} />
          </Card>
        )}

        <Card icon={UtensilsCrossed} title="Refeições" href="/cardapio" linkLabel="Ver cardápio da semana">
          <MealsCard meals={props.meals} />
        </Card>

        {props.medical.hasAny && (
          <Card icon={Stethoscope} title="Saúde" href={props.medical.spaceHref ?? undefined} linkLabel="Ver registros">
            {props.medical.nextConsultaLabel ? (
              <p className="text-sm text-black dark:text-zinc-100">
                Próxima consulta: <strong>{props.medical.nextConsultaLabel}</strong>
              </p>
            ) : (
              <Empty>Nenhuma consulta marcada.</Empty>
            )}
            <a href="/api/saude/resumo/export" target="_blank" rel="noopener noreferrer" className="self-start text-xs font-medium text-brand-text hover:underline">
              Resumo pra levar ao médico →
            </a>
          </Card>
        )}

        {workout && (
          <Card icon={Dumbbell} title="Treino" href="/treinos" linkLabel="Abrir treinos">
            {workout.done ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Treino de hoje registrado. Bom trabalho!
              </p>
            ) : (
              <>
                <Link href="/treinos" className="flex items-center gap-3 rounded-xl bg-brand-soft px-3 py-3 hover:opacity-90">
                  <span className="bg-brand text-brand-fg flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold">{workout.letter}</span>
                  <span className="flex flex-col">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Próximo treino</span>
                    <span className="font-semibold text-black dark:text-zinc-50">
                      {workout.name ? `Treino ${workout.letter} · ${workout.name}` : `Treino ${workout.letter}`}
                    </span>
                  </span>
                </Link>
                <QuickLogWorkoutButton programId={workout.programId} date={props.todayDateStr} week={workout.week} letter={workout.letter} />
              </>
            )}
          </Card>
        )}

        <Card icon={Clock3} title="Abertos recentemente" href="/buscar" linkLabel="Buscar">
          <Rows rows={props.recent} empty="Nada por aqui ainda." />
        </Card>
      </div>

      {props.inboxCount > 0 && (
        <Link
          href="/inbox"
          className="flex items-center gap-3 rounded-2xl border border-dashed border-brand/40 bg-brand-soft px-5 py-4 text-sm text-black hover:border-brand dark:text-zinc-100"
        >
          <Inbox className="h-5 w-5 shrink-0 text-brand-text" aria-hidden />
          <span className="flex-1">
            <strong>{props.inboxCount}</strong> {props.inboxCount === 1 ? "item esperando" : "itens esperando"} pra ser organizado no Inbox.
          </span>
          <span className="shrink-0 font-medium text-brand-text">Organizar →</span>
        </Link>
      )}
    </div>
  );
}
