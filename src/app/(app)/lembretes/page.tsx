import { listContacts } from "@/features/contacts/queries";
import { RemindersWorkspace } from "@/features/reminders/components/reminders-workspace";
import { getUserTimezone, listFailedDeliveries, listRecurringReminders, listSentDeliveries, listUpcomingReminders } from "@/features/reminders/queries";
import { requireOwner } from "@/lib/auth";

export default async function LembretesPage() {
  const { supabase, user } = await requireOwner();

  const [contacts, upcoming, recurring, sent, failed, timezone] = await Promise.all([
    listContacts(supabase, {}),
    listUpcomingReminders(supabase),
    listRecurringReminders(supabase),
    listSentDeliveries(supabase),
    listFailedDeliveries(supabase),
    getUserTimezone(supabase, user.id),
  ]);

  return (
    <RemindersWorkspace
      contacts={contacts}
      defaultTimezone={timezone}
      initialUpcoming={upcoming}
      initialRecurring={recurring}
      initialSent={sent}
      initialFailed={failed}
    />
  );
}
