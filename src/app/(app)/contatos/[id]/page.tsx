import { notFound } from "next/navigation";
import { ContactDetail } from "@/features/contacts/components/contact-detail";
import { getContactActivity, getContactById } from "@/features/contacts/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

export default async function ContactDetailPage(props: PageProps<"/contatos/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireOwner();

  const contact = await getContactById(supabase, id);
  if (!contact) notFound();

  const [spaces, activity] = await Promise.all([listActiveSpaces(supabase), getContactActivity(supabase, contact)]);

  return <ContactDetail spaces={spaces} contact={contact} activity={activity} />;
}
