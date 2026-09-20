import { OwnerNotificationsToggle } from "@/features/settings/components/owner-notifications-toggle";
import { getOwnerNotificationPreferences } from "@/features/settings/queries";
import { PushSettings } from "@/features/push/components/push-settings";
import { listPushSubscriptions } from "@/features/push/queries";
import { requireOwner } from "@/lib/auth";

export default async function NotificationsSettingsPage() {
  const { supabase, user } = await requireOwner();
  const [subscriptions, preferences] = await Promise.all([
    listPushSubscriptions(supabase),
    getOwnerNotificationPreferences(supabase, user.id),
  ]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Notificações</h1>
        <p className="text-sm text-black/60 dark:text-white/60">Push neste dispositivo e avisos importantes pro dono.</p>
      </div>
      <PushSettings initialSubscriptions={subscriptions} />
      <OwnerNotificationsToggle initialPreferences={preferences} />
    </div>
  );
}
