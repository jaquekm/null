"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { fail, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { buildSpaceRows } from "./lib/spaces";
import { SYSTEM_TYPE_SEEDS } from "./lib/system-types";
import { onboardingSchema } from "./schemas";

const GENERIC_ERROR = "Não foi possível concluir a configuração inicial. Tente de novo.";

/**
 * Cria os espaços escolhidos, os 6 tipos básicos (`is_system = true`) e
 * marca `user_settings.onboarding_completed_at`. Usa `upsert` por `slug`
 * (espaços e tipos) e por `owner_id` (configurações) para que, se algo
 * falhar no meio, reenviar o formulário não duplique nada.
 */
export async function completeOnboarding(
  _prevState: Result<null>,
  formData: FormData,
): Promise<Result<null>> {
  const rawSpaces = formData.get("spacesJson");
  let spacesInput: unknown;
  try {
    spacesInput = JSON.parse(typeof rawSpaces === "string" ? rawSpaces : "[]");
  } catch {
    return fail(GENERIC_ERROR);
  }

  const parsed = onboardingSchema.safeParse({
    spaces: spacesInput,
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  }

  const spaceRows = buildSpaceRows(parsed.data.spaces);
  if (spaceRows.length === 0) {
    return fail("Escolha ao menos um espaço.");
  }

  const { supabase, user } = await requireOwner();

  const { data: insertedSpaces, error: spacesError } = await supabase
    .from("spaces")
    .upsert(
      spaceRows.map((row) => ({
        owner_id: user.id,
        name: row.name,
        slug: row.slug,
        icon: row.icon,
        color: row.color,
        position: row.position,
      })),
      { onConflict: "owner_id,slug" },
    )
    .select("id, slug");

  if (spacesError || !insertedSpaces) {
    return fail(GENERIC_ERROR);
  }

  const { error: typesError } = await supabase.from("object_types").upsert(
    SYSTEM_TYPE_SEEDS.map((seed, index) => ({
      owner_id: user.id,
      space_id: null,
      name: seed.name,
      plural_name: seed.pluralName,
      slug: seed.slug,
      icon: seed.icon,
      fields: seed.fields as unknown as Json,
      is_system: true,
      position: index,
    })),
    { onConflict: "owner_id,slug" },
  );

  if (typesError) {
    return fail(GENERIC_ERROR);
  }

  const defaultSpaceId =
    insertedSpaces.find((space) => space.slug === spaceRows[0]?.slug)?.id ?? null;

  const { error: settingsError } = await supabase.from("user_settings").upsert(
    {
      owner_id: user.id,
      timezone: parsed.data.timezone,
      default_space_id: defaultSpaceId,
      onboarding_completed_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );

  if (settingsError) {
    return fail(GENERIC_ERROR);
  }

  redirect("/inbox");
}
