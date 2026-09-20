import { notFound } from "next/navigation";
import { ContactDetail } from "@/features/contacts/components/contact-detail";
import { getContactActivity, getContactById } from "@/features/contacts/queries";
import { getUserTimezone } from "@/features/reminders/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

export default async function ContactDetailPage(props: PageProps<"/contatos/[id]">) {
  const { id } = await props.params;
  const { supabase, user } = await requireOwner();

  const contact = await getContactById(supabase, id);
  if (!contact) notFound();

  const [spaces, activity, timezone] = await Promise.all([
    listActiveSpaces(supabase),
    getContactActivity(supabase, contact),
    getUserTimezone(supabase, user.id),
  ]);

  return <ContactDetail spaces={spaces} contact={contact} activity={activity} timezone={timezone} />;
}
