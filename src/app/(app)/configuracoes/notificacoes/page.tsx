import { OwnerNotificationsToggle } from "@/features/settings/components/owner-notifications-toggle";
import { OwnerWhatsappField } from "@/features/settings/components/owner-whatsapp-field";
import { DeliveryStatus } from "@/features/settings/components/delivery-status";
import { getDeliveryChecks, getOwnerNotificationPreferences, getOwnerWhatsapp } from "@/features/settings/queries";
import { PushSettings } from "@/features/push/components/push-settings";
import { listPushSubscriptions } from "@/features/push/queries";
import { requireOwner } from "@/lib/auth";
import { isWhatsAppChannelReady } from "@/lib/messaging";

export default async function NotificationsSettingsPage() {
  const { supabase, user } = await requireOwner();
  const [subscriptions, preferences, ownerWhatsapp, checks] = await Promise.all([
    listPushSubscriptions(supabase),
    getOwnerNotificationPreferences(supabase, user.id),
    getOwnerWhatsapp(supabase, user.id),
    getDeliveryChecks(supabase, user.id),
  ]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Notificações</h1>
        <p className="text-sm text-black/60 dark:text-white/60">Push neste dispositivo e avisos importantes pro dono.</p>
      </div>
      <DeliveryStatus checks={checks} />
      <PushSettings initialSubscriptions={subscriptions} />
      <OwnerWhatsappField initialPhone={ownerWhatsapp} channelReady={isWhatsAppChannelReady()} />
      <OwnerNotificationsToggle initialPreferences={preferences} />
    </div>
  );
}
