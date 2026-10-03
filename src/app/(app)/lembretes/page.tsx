import { listContacts } from "@/features/contacts/queries";
import { RemindersWorkspace } from "@/features/reminders/components/reminders-workspace";
import { getUserTimezone, listFailedDeliveries, listRecurringReminders, listSentDeliveries, listUpcomingReminders } from "@/features/reminders/queries";
import { DeliveryStatus } from "@/features/settings/components/delivery-status";
import { getDeliveryChecks } from "@/features/settings/queries";
import { requireOwner } from "@/lib/auth";

export default async function LembretesPage() {
  const { supabase, user } = await requireOwner();

  const [contacts, upcoming, recurring, sent, failed, timezone, checks] = await Promise.all([
    listContacts(supabase, {}),
    listUpcomingReminders(supabase),
    listRecurringReminders(supabase),
    listSentDeliveries(supabase),
    listFailedDeliveries(supabase),
    getUserTimezone(supabase, user.id),
    getDeliveryChecks(supabase, user.id),
  ]);

  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-6 pt-6 empty:hidden">
        <DeliveryStatus checks={checks} compact />
      </div>
      <RemindersWorkspace
        contacts={contacts}
        defaultTimezone={timezone}
        initialUpcoming={upcoming}
        initialRecurring={recurring}
        initialSent={sent}
        initialFailed={failed}
      />
    </>
  );
}
