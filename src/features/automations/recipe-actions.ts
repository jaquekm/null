"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setEventAlert } from "@/features/reminders/actions";
import { getUserTimezone } from "@/features/reminders/queries";
import { requireOwner } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { findRecipeAutomation, findRecipeRule, getRecipe, RECIPE_CHANNELS, RECIPE_KEYS, recipePackKey, withNotifyChannel, type RecipeAutomationRow, type RecipeChannel, type RecipeRuleRow } from "./lib/recipes";
import { getRecipesOverview } from "./queries";
import { automationInputSchema, type AutomationAction } from "./schemas";

const inputSchema = z.object({
  key: z.enum(RECIPE_KEYS),
  active: z.boolean(),
  channel: z.enum(RECIPE_CHANNELS).nullable().optional(),
});

const ERROR = "Não foi possível salvar a receita. Tente de novo.";

function revalidateRecipePaths() {
  revalidatePath("/configuracoes/automacoes");
  revalidatePath("/lembretes/regras");
  revalidatePath("/agenda");
}

/**
 * Liga/desliga uma receita pronta (9.8) com um toque, ou troca o canal dela.
 * Desligar não apaga nada — desativa a regra/automação (e cancela os
 * lembretes já agendados por ela), pra ligar de novo voltar igual.
 */
export async function setRecipeActive(input: z.input<typeof inputSchema>): Promise<Result<null>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return fail("Receita inválida.");
  const recipe = getRecipe(parsed.data.key)!;
  const { active } = parsed.data;

  const { supabase, user } = await requireOwner();
  const overview = await getRecipesOverview(supabase, user.id);
  const current = overview.states[recipe.key];

  let channel: RecipeChannel | null = parsed.data.channel ?? current.channel;
  if (recipe.channels.length === 0) channel = null;
  else if (!channel || !recipe.channels.includes(channel)) channel = recipe.channels[0]!;
  if (active && channel === "whatsapp" && !overview.ownerWhatsapp) return fail("Cadastre seu WhatsApp em Configurações → Notificações primeiro.");

  if (recipe.engine === "event_alert") {
    const result = await setEventAlert({ minutesBefore: active ? (current.minutesBefore ?? recipe.minutesBefore) : null, channel: channel ?? "push" });
    if (!result.ok) return fail(result.error);
    revalidateRecipePaths();
    return ok(null);
  }

  if (recipe.engine === "reminder_rule") {
    const { data: rules } = await supabase.from("reminder_rules").select("id, kind, recipient_type, channel, enabled, config, created_at").eq("owner_id", user.id);
    const existing = findRecipeRule((rules ?? []) as RecipeRuleRow[], recipe.key);
    const ruleChannel = channel ?? "auto";

    if (!active) {
      if (existing) {
        const { error } = await supabase.from("reminder_rules").update({ enabled: false }).eq("id", existing.id).eq("owner_id", user.id);
        if (error) return fail(ERROR);
        await supabase.from("reminders").update({ status: "canceled" }).eq("owner_id", user.id).eq("rule_id", existing.id).eq("status", "scheduled");
      }
      revalidateRecipePaths();
      return ok(null);
    }

    if (existing) {
      const { error } = await supabase.from("reminder_rules").update({ enabled: true, channel: ruleChannel }).eq("id", existing.id).eq("owner_id", user.id);
      if (error) return fail(ERROR);
      // O job só recalcula horário dos lembretes já gerados, não o canal (mesmo cuidado do aviso de eventos, 9.4).
      await supabase.from("reminders").update({ channel: ruleChannel }).eq("owner_id", user.id).eq("rule_id", existing.id).eq("status", "scheduled");
    } else {
      const { error } = await supabase.from("reminder_rules").insert({
        owner_id: user.id,
        name: recipe.rule.name,
        kind: recipe.rule.kind,
        channel: ruleChannel,
        recipient_type: recipe.rule.recipientType,
        message_template: recipe.rule.messageTemplate,
        enabled: true,
        config: { ...recipe.rule.config, recipe: recipe.key } as unknown as Json,
      });
      if (error) return fail(ERROR);
    }

    try {
      await enqueueJob({ ownerId: user.id, kind: "generate_reminders", dedupeKey: `generate_reminders:recipe:${user.id}` });
    } catch {
      // O ciclo normal do generate_reminders (a cada 15 min) cobre.
    }
    revalidateRecipePaths();
    return ok(null);
  }

  // Automação de item/horário.
  const { data: automations } = await supabase.from("automations").select("id, enabled, pack_key, actions, created_at").eq("owner_id", user.id).eq("pack_key", recipePackKey(recipe.key));
  const existing = findRecipeAutomation((automations ?? []) as RecipeAutomationRow[], recipe.key);

  if (!active) {
    if (existing) {
      const { error } = await supabase.from("automations").update({ enabled: false }).eq("id", existing.id).eq("owner_id", user.id);
      if (error) return fail(ERROR);
    }
    revalidateRecipePaths();
    return ok(null);
  }

  const notifyChannel = channel ?? "push";
  if (existing) {
    // Mantém gatilho/horário que a dona possa ter ajustado — só troca o canal do "me avisar".
    const actions = withNotifyChannel(((existing.actions ?? []) as AutomationAction[]) ?? [], notifyChannel);
    const { error } = await supabase
      .from("automations")
      .update({ enabled: true, actions: actions as unknown as Json })
      .eq("id", existing.id)
      .eq("owner_id", user.id);
    if (error) return fail(ERROR);
  } else {
    const timezone = await getUserTimezone(supabase, user.id);
    const built = automationInputSchema.safeParse(recipe.build(notifyChannel, new Date(), timezone));
    if (!built.success) return fail(ERROR);
    const { error } = await supabase.from("automations").insert({
      owner_id: user.id,
      name: built.data.name,
      description: built.data.description || null,
      enabled: true,
      space_id: built.data.spaceId,
      type_id: built.data.typeId,
      trigger: built.data.trigger as unknown as Json,
      conditions: built.data.conditions as unknown as Json,
      actions: built.data.actions as unknown as Json,
      pack_key: recipePackKey(recipe.key),
    });
    if (error) return fail(ERROR);
  }

  revalidateRecipePaths();
  return ok(null);
}
