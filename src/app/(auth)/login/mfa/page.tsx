import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { MfaForm } from "./mfa-form";

export default async function LoginMfaPage(props: PageProps<"/login/mfa">) {
  const { next } = await props.searchParams;
  const nextValue = safeNext(typeof next === "string" ? next : undefined);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const factor = factorsData?.totp[0];

  if (!factor) {
    // Não deveria acontecer: só chegamos aqui quando requireOwner()/login
    // detectam um fator de MFA verificado pendente de confirmação na sessão.
    redirect("/login");
  }

  const { data: challenge, error } = await supabase.auth.mfa.challenge({
    factorId: factor.id,
  });

  if (error || !challenge) {
    redirect("/login");
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Verificação em duas etapas
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Digite o código de 6 dígitos do seu aplicativo autenticador.
        </p>
      </div>
      <MfaForm
        factorId={factor.id}
        challengeId={challenge.id}
        next={nextValue}
      />
    </div>
  );
}
