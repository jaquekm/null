import { listObjectTypesForPicker } from "@/features/items/queries";
import { ReminderRulesWorkspace } from "@/features/reminders/components/reminder-rules-workspace";
import { listReminderRules } from "@/features/reminders/queries";
import { requireOwner } from "@/lib/auth";

export default async function ReminderRulesPage() {
  const { supabase } = await requireOwner();

  const [types, rules] = await Promise.all([listObjectTypesForPicker(supabase), listReminderRules(supabase)]);

  return <ReminderRulesWorkspace types={types} initialRules={rules} />;
}
