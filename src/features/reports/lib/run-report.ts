import "server-only";
import { getUserTimezone } from "@/features/reminders/queries";
import type { BaseReportParams } from "../schemas";
import type { Client, ReportContext, ReportGenerator } from "../types";
import { resolveRelativePeriod } from "./resolve-period";

export interface RanReport<D> {
  data: D;
  title: string;
  periodStart: string;
  periodEnd: string;
}

/** Fluxo comum a todo relatório pronto (6.2): resolve parâmetros/período, chama `collect`, monta o título — sem gravar nada (`report_runs` fica pra quem chama). */
export async function runReport<P extends BaseReportParams, D>(
  generator: ReportGenerator<P, D>,
  supabase: Client,
  ownerId: string,
  rawParams: unknown,
  now: Date = new Date(),
): Promise<RanReport<D>> {
  const params = generator.paramsSchema.parse(rawParams);
  const timezone = await getUserTimezone(supabase, ownerId);
  const custom = params.period === "custom" ? { start: params.customStart ?? "", end: params.customEnd ?? "" } : undefined;
  const period = resolveRelativePeriod(params.period, now, timezone, custom);

  const ctx: ReportContext<P> = { supabase, ownerId, timezone, params, ...period };
  const data = await generator.collect(ctx);
  const title = generator.title(params, period.startDateKey, period.endDateKey);

  return { data, title, periodStart: period.startDateKey, periodEnd: period.endDateKey };
}
