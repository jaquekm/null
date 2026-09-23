import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import type { z } from "zod";
import { computeRollupsForRows } from "@/features/types/lib/rollup-query";
import { getObjectTypeBySlug } from "@/features/types/queries";
import type { ReportBlock } from "../lib/blocks";
import { baseReportParamsSchema } from "../schemas";
import type { ReportContext, ReportGenerator } from "../types";

export const projectsStatusParamsSchema = baseReportParamsSchema;
export type ProjectsStatusParams = z.infer<typeof projectsStatusParamsSchema>;

const ACTIVE_STATUSES = new Set(["planejado", "em_andamento"]);

export interface ProjectStatusRow {
  id: string;
  title: string;
  status: string | null;
  progressPercent: number;
}

export interface TaskRow {
  id: string;
  title: string;
  projectId: string | null;
  dueOn: string | null;
}

export interface MilestoneRow {
  id: string;
  title: string;
  projectId: string | null;
  date: string | null;
}

export interface ProjectsStatusData {
  installed: boolean;
  projects: ProjectStatusRow[];
  overdueTasks: TaskRow[];
  completedTasksInPeriod: TaskRow[];
  overdueMilestones: MilestoneRow[];
}

function stringProp(properties: Record<string, unknown>, key: string): string | null {
  const raw = properties[key];
  return typeof raw === "string" && raw ? raw : null;
}

function relationId(properties: Record<string, unknown>, key: string): string | null {
  const raw = properties[key];
  return typeof raw === "string" ? raw : Array.isArray(raw) && typeof raw[0] === "string" ? raw[0] : null;
}

/** "Status de projetos" (6.2b) — pack Projetos (5.8): projetos ativos com progresso (campo `rollup`, calculado com o mesmo motor da 5.8), marcos atrasados, tarefas atrasadas/concluídas no período. `installed:false` quando o pack não está instalado (sem erro, mesma convenção de `weekly-review/queries.ts`). */
export const projectsStatusReport: ReportGenerator<ProjectsStatusParams, ProjectsStatusData> = {
  kind: "projects_status",
  label: "Status de projetos",
  paramsSchema: projectsStatusParamsSchema,

  async collect(ctx: ReportContext<ProjectsStatusParams>): Promise<ProjectsStatusData> {
    const { supabase, start, end, timezone } = ctx;
    const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

    const projectType = await getObjectTypeBySlug(supabase, "projeto");
    if (!projectType) return { installed: false, projects: [], overdueTasks: [], completedTasksInPeriod: [], overdueMilestones: [] };

    const [taskType, milestoneType] = await Promise.all([getObjectTypeBySlug(supabase, "tarefa"), getObjectTypeBySlug(supabase, "marco")]);

    const { data: projectRows } = await supabase.from("items").select("id, title, properties").eq("type_id", projectType.id).is("deleted_at", null);
    const activeProjects = (projectRows ?? []).filter((row) => ACTIVE_STATUSES.has(stringProp((row.properties as Record<string, unknown>) ?? {}, "status") ?? ""));
    const progressByProject = await computeRollupsForRows(
      supabase,
      activeProjects.map((p) => ({ id: p.id })),
      projectType.fields,
    );
    const projects: ProjectStatusRow[] = activeProjects.map((row) => ({
      id: row.id,
      title: row.title || "Sem título",
      status: stringProp((row.properties as Record<string, unknown>) ?? {}, "status"),
      progressPercent: progressByProject.get(row.id)?.progress ?? 0,
    }));

    const overdueTasks: TaskRow[] = [];
    const completedTasksInPeriod: TaskRow[] = [];
    if (taskType) {
      const { data } = await supabase.from("items").select("id, title, properties, updated_at").eq("type_id", taskType.id).is("deleted_at", null);
      for (const row of data ?? []) {
        const properties = (row.properties as Record<string, unknown>) ?? {};
        const status = stringProp(properties, "status");
        const dueOn = stringProp(properties, "prazo");
        const task: TaskRow = { id: row.id, title: row.title || "Sem título", projectId: relationId(properties, "project"), dueOn };
        if (status !== "done" && dueOn && dueOn < today) overdueTasks.push(task);
        if (status === "done" && row.updated_at >= start && row.updated_at <= end) completedTasksInPeriod.push(task);
      }
    }

    let overdueMilestones: MilestoneRow[] = [];
    if (milestoneType) {
      const { data } = await supabase.from("items").select("id, title, properties").eq("type_id", milestoneType.id).is("deleted_at", null);
      overdueMilestones = (data ?? [])
        .map((row) => {
          const properties = (row.properties as Record<string, unknown>) ?? {};
          return { id: row.id, title: row.title || "Sem título", projectId: relationId(properties, "project"), date: stringProp(properties, "date"), done: properties.done === true };
        })
        .filter((m) => !m.done && m.date && m.date < today)
        .map(({ id, title, projectId, date }) => ({ id, title, projectId, date }));
    }

    return { installed: true, projects, overdueTasks, completedTasksInPeriod, overdueMilestones };
  },

  title() {
    return "Status de projetos";
  },

  toBlocks(data): ReportBlock[] {
    if (!data.installed) return [{ kind: "text", body: "O pack Projetos e planejamentos não está instalado." }];
    return [
      {
        kind: "bars",
        title: "Projetos ativos",
        rows: data.projects.map((p) => ({ label: p.title, valueLabel: `${Math.round(p.progressPercent)}%`, percent: p.progressPercent })),
        emptyText: "Nenhum projeto ativo.",
      },
      {
        kind: "list",
        title: "Tarefas atrasadas",
        rows: data.overdueTasks.map((t) => ({ label: t.title, sublabel: t.dueOn ?? undefined, tone: "red" })),
        emptyText: "Nenhuma tarefa atrasada.",
      },
      {
        kind: "list",
        title: "Tarefas concluídas no período",
        rows: data.completedTasksInPeriod.map((t) => ({ label: t.title, tone: "emerald" })),
        emptyText: "Nenhuma tarefa concluída no período.",
      },
      {
        kind: "list",
        title: "Marcos atrasados",
        rows: data.overdueMilestones.map((m) => ({ label: m.title, sublabel: m.date ?? undefined, tone: "red" })),
        emptyText: "Nenhum marco atrasado.",
      },
    ];
  },
};
