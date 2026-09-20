import { ContactsWorkspace } from "@/features/contacts/components/contacts-workspace";
import { listContacts } from "@/features/contacts/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

export default async function ContatosPage() {
  const { supabase } = await requireOwner();

  const [spaces, contacts] = await Promise.all([listActiveSpaces(supabase), listContacts(supabase, {})]);

  return <ContactsWorkspace spaces={spaces} initialContacts={contacts} />;
}
