import { formatInTimeZone } from "date-fns-tz";
import { notFound } from "next/navigation";
import { ContactDetail } from "@/features/contacts/components/contact-detail";
import { getContactActivity, getContactById } from "@/features/contacts/queries";
import { getContactFinanceSummary } from "@/features/financas/queries";
import { getUserTimezone } from "@/features/reminders/queries";
import { getContactSalesSummary, getSalesTypeIds } from "@/features/sales/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

export default async function ContactDetailPage(props: PageProps<"/contatos/[id]">) {
  const { id } = await props.params;
  const { supabase, user } = await requireOwner();

  const contact = await getContactById(supabase, id);
  if (!contact) notFound();

  const timezone = await getUserTimezone(supabase, user.id);
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

  const [spaces, activity, finance, salesTypeIds] = await Promise.all([
    listActiveSpaces(supabase),
    getContactActivity(supabase, contact),
    getContactFinanceSummary(supabase, contact.id, today),
    getSalesTypeIds(supabase),
  ]);

  const sales = salesTypeIds ? await getContactSalesSummary(supabase, contact.id, salesTypeIds) : null;

  return <ContactDetail spaces={spaces} contact={contact} activity={activity} timezone={timezone} finance={finance} sales={sales} />;
}
