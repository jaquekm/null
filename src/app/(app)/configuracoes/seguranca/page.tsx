import { createClient } from "@/lib/supabase/server";
import { ChangePasswordForm } from "./change-password-form";
import { MfaSection } from "./mfa-section";
import { SignOutEverywhereButton } from "./sign-out-everywhere-button";

export default async function SegurancaPage() {
  const supabase = await createClient();
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const initialFactors = (factorsData?.totp ?? []).map((factor) => ({
    id: factor.id,
    friendlyName: factor.friendly_name ?? null,
    status: factor.status,
  }));

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-10 p-6">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Segurança
      </h1>
      <MfaSection initialFactors={initialFactors} />
      <ChangePasswordForm />
      <SignOutEverywhereButton />
    </div>
  );
}
