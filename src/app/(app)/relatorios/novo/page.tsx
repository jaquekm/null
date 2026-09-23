import { listTypesWithFields } from "@/features/automations/queries";
import { listCategories } from "@/features/financas/queries";
import { CustomReportBuilder } from "@/features/reports/components/custom-report-builder";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

export default async function NovoRelatorioPage() {
  const { supabase, user } = await requireOwner();
  const [types, spaces, categories] = await Promise.all([listTypesWithFields(supabase, user.id), listActiveSpaces(supabase), listCategories(supabase)]);

  return <CustomReportBuilder types={types} spaces={spaces} categories={categories} />;
}
