"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type Result } from "@/lib/result";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "Código inválido.";

const schema = z.object({
  factorId: z.string().min(1),
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
  next: z.string().optional(),
});

export async function verifyMfa(
  _prevState: Result<null>,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = schema.safeParse({
    factorId: formData.get("factorId"),
    challengeId: formData.get("challengeId"),
    code: formData.get("code"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return fail(GENERIC_ERROR);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.verify({
    factorId: parsed.data.factorId,
    challengeId: parsed.data.challengeId,
    code: parsed.data.code,
  });

  if (error) {
    return fail(GENERIC_ERROR);
  }

  redirect(safeNext(parsed.data.next));
}
