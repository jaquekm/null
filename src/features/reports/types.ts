import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import type { ReportBlock } from "./lib/blocks";
import type { BaseReportParams, ReportKind } from "./schemas";

export type Client = SupabaseClient<Database>;

export interface ReportContext<P> {
  supabase: Client;
  ownerId: string;
  timezone: string;
  params: P;
  /** Início/fim do período, já resolvidos (`resolveRelativePeriod`). */
  start: string;
  end: string;
  startDateKey: string;
  endDateKey: string;
}

/** Um relatório pronto (6.2): resolve os próprios parâmetros, busca os dados e nomeia o resultado. */
export interface ReportGenerator<P extends BaseReportParams, D> {
  kind: ReportKind;
  label: string;
  paramsSchema: z.ZodType<P>;
  collect(ctx: ReportContext<P>): Promise<D>;
  title(params: P, startDateKey: string, endDateKey: string): string;
  /** Quando presente, a tela/PDF genéricos (6.2b) renderizam este relatório a partir de `ReportBlock[]`; sem isso, precisa de componente próprio (só `finance_monthly` tem hoje). */
  toBlocks?(data: D): ReportBlock[];
}
