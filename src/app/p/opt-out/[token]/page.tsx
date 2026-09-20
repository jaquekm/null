import { OptOutConfirmForm } from "@/features/sharing/components/opt-out-confirm-form";
import { verifyOptOutToken } from "@/lib/messaging/opt-out-token";
import { createAdminClient } from "@/lib/supabase/admin";

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "e-mail",
};

function InvalidTokenMessage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 p-10 text-center">
      <h1 className="text-lg font-medium text-black dark:text-zinc-50">Link inválido ou expirado</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Peça pra quem enviou a mensagem enviar um link novo.</p>
    </div>
  );
}

export default async function OptOutPage(props: PageProps<"/p/opt-out/[token]">) {
  const { token } = await props.params;
  const payload = verifyOptOutToken(token);
  if (!payload) return <InvalidTokenMessage />;

  const admin = createAdminClient();
  const { data: contact } = await admin.from("contacts").select("name").eq("id", payload.contactId).maybeSingle();
  if (!contact) return <InvalidTokenMessage />;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
      <h1 className="text-lg font-medium text-black dark:text-zinc-50">Parar de receber mensagens?</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {contact.name}, ao confirmar você deixa de receber lembretes e avisos por {CHANNEL_LABELS[payload.channel] ?? payload.channel}
        (e por qualquer outro canal).
      </p>
      <OptOutConfirmForm token={token} />
    </div>
  );
}
