import "server-only";
import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Deve ser chamada por toda página autenticada e server action.
 * Garante: usuário logado, é o dono (OWNER_EMAIL) e, se tiver MFA
 * cadastrado, que a sessão está em aal2 (código já verificado).
 */
export async function requireOwner() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (user.email !== serverEnv.OWNER_EMAIL) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect("/login/mfa");
  }

  return { supabase, user };
}
