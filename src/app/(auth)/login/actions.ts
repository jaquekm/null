"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type Result } from "@/lib/result";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "E-mail ou senha inválidos.";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function login(
  _prevState: Result<null>,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return fail(GENERIC_ERROR);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return fail(GENERIC_ERROR);
  }

  const next = safeNext(parsed.data.next);
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect(`/login/mfa?next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}
