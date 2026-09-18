import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { OnboardingForm } from "@/features/onboarding/components/onboarding-form";

export default async function BoasVindasPage() {
  const { supabase, user } = await requireOwner();

  const { data: settings } = await supabase
    .from("user_settings")
    .select("onboarding_completed_at")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (settings?.onboarding_completed_at) {
    redirect("/inbox");
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Bem-vindo(a) ao Hub</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Vamos configurar o básico antes de começar: os espaços onde suas notas e itens vão morar, e o fuso horário
          para datas e lembretes.
        </p>
      </div>
      <OnboardingForm />
    </div>
  );
}
