"use server";

import type { JSONContent } from "@tiptap/core";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { getUserTimezone } from "@/features/reminders/queries";
import { buildRRuleString } from "@/features/reminders/lib/recurrence";
import { installPack } from "@/features/packs/lib/install";
import { listLocalPacks } from "@/features/packs/queries";
import { findTemplate, templateProperties } from "@/features/templates/lib/templates";
import { addItemToSection } from "@/features/items/lib/list-styles";
import { extractText } from "@/features/items/lib/extract-text";
import { requireOwner } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { addDaysToDateString, todayInTimezone, wallClockToIso } from "@/lib/dates";
import { fail, ok, type Result } from "@/lib/result";
import type { Database, Json } from "@/lib/supabase/database.types";
import { daysUntilEmpty, dosesPerDay, isLowStock } from "./lib/medication-stock";
import { createMedicationSchema, setMedicationScheduleSchema, setMedicationStockSchema } from "./schemas";

type Client = SupabaseClient<Database>;

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";

async function findMedicationTypeId(supabase: Client): Promise<string | null> {
  const { data } = await supabase.from("object_types").select("id").eq("slug", "remedio").is("archived_at", null).order("created_at", { ascending: true }).limit(1);
  return data?.[0]?.id ?? null;
}

/**
 * Cancela os avisos de dose ainda não enviados (`source_type = 'medication_dose'`)
 * e recria um por horário, com RRULE diária — mesmo padrão de `setItemExpiry`
 * (9.5): mudar os horários nunca deixa aviso velho pra trás. `false` = os
 * horários foram salvos, mas o agendamento falhou (a dona pode salvar de novo).
 */
async function scheduleMedicationReminders(
  supabase: Client,
  ownerId: string,
  itemId: string,
  title: string,
  dose: string | undefined,
  horarios: string[],
  timezone: string,
): Promise<boolean> {
  await supabase
    .from("reminders")
    .update({ status: "canceled" })
    .eq("owner_id", ownerId)
    .eq("item_id", itemId)
    .eq("source_type", "medication_dose")
    .eq("status", "scheduled");

  if (horarios.length === 0) return true;

  const now = Date.now();
  const today = todayInTimezone(timezone);
  const link = `${serverEnv.APP_URL}/itens/${itemId}`;
  const messageTemplate = dose ? "💊 Hora do remédio: {{titulo}} — {{dose}}\n{{link}}" : "💊 Hora do remédio: {{titulo}}\n{{link}}";

  const rows = horarios.map((horario) => {
    const candidate = wallClockToIso(`${today}T${horario}:00`, timezone);
    const sendAt = Date.parse(candidate) > now ? candidate : wallClockToIso(`${addDaysToDateString(today, 1)}T${horario}:00`, timezone);
    return {
      owner_id: ownerId,
      title: title || "Remédio",
      message_template: messageTemplate,
      channel: "auto",
      recipient_type: "me",
      contact_ids: [],
      send_at: sendAt,
      rrule: buildRRuleString({ kind: "daily" }, new Date(sendAt), timezone),
      timezone,
      variables: { link, dose: dose ?? "" } as unknown as Json,
      item_id: itemId,
      source_type: "medication_dose",
    };
  });

  const { error } = await supabase.from("reminders").insert(rows);
  return !error;
}

async function readPreferences(supabase: Client, ownerId: string): Promise<Record<string, unknown>> {
  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle();
  return (data?.preferences as Record<string, unknown> | null) ?? {};
}

/**
 * "Acaba em 5 dias" (10.5): soma o remédio na lista de compras — a mesma
 * lembrada em `preferences.shoppingListItemId` (9.7: não existe um jeito de
 * achar "a" lista de compras programaticamente, então guardamos o id da
 * última usada). Sem o pack Listas instalado, só não soma — o aviso continua
 * aparecendo na tela mesmo assim.
 */
async function addMedicationToShoppingList(supabase: Client, ownerId: string, medicationTitle: string): Promise<boolean> {
  const preferences = await readPreferences(supabase, ownerId);
  const savedId = typeof preferences.shoppingListItemId === "string" ? preferences.shoppingListItemId : null;

  let listItem: { id: string; content: unknown } | null = null;
  if (savedId) {
    const { data } = await supabase.from("items").select("id, content").eq("id", savedId).eq("owner_id", ownerId).is("deleted_at", null).maybeSingle();
    listItem = data ?? null;
  }

  if (!listItem) {
    const template = findTemplate("lista-compras");
    if (!template) return false;
    const { data: types } = await supabase.from("object_types").select("id").eq("slug", template.typeSlug).is("archived_at", null).is("space_id", null).limit(1);
    const typeId = types?.[0]?.id;
    if (!typeId) return false;

    const { data: created, error } = await supabase
      .from("items")
      .insert({ owner_id: ownerId, type_id: typeId, title: template.defaultTitle, status: "active", properties: templateProperties(template) as Json })
      .select("id, content")
      .single();
    if (error || !created) return false;
    listItem = created;

    await supabase
      .from("user_settings")
      .upsert({ owner_id: ownerId, preferences: { ...preferences, shoppingListItemId: created.id } as unknown as Json }, { onConflict: "owner_id" });
  }

  const nextContent = addItemToSection(listItem.content as JSONContent | null, 0, `Comprar ${medicationTitle}`);
  const { error } = await supabase
    .from("items")
    .update({ content: nextContent as unknown as Json, content_text: extractText(nextContent) })
    .eq("id", listItem.id)
    .eq("owner_id", ownerId);
  return !error;
}

/**
 * "+ Remédio" (10.5). Sem o tipo ainda, instala o pacote "Saúde" antes — o
 * mesmo que Configurações → Métodos faria (mesma ideia de `createHabit`, 10.1).
 */
export async function createMedication(input: z.input<typeof createMedicationSchema>): Promise<Result<{ id: string }>> {
  const parsed = createMedicationSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const { supabase, user } = await requireOwner();
  let typeId = await findMedicationTypeId(supabase);
  if (!typeId) {
    const pack = (await listLocalPacks()).find((entry) => entry.pack?.key === "saude")?.pack;
    if (!pack) return fail("Não achei o pacote de saúde.");
    const installed = await installPack(supabase, user.id, pack, { spaceId: null });
    if (!installed.ok) return fail("Não foi possível preparar os remédios. Tente de novo.");
    typeId = await findMedicationTypeId(supabase);
    if (!typeId) return fail("Não foi possível preparar os remédios. Tente de novo.");
  }

  const { data, error } = await supabase
    .from("items")
    .insert({
      owner_id: user.id,
      title: parsed.data.title,
      type_id: typeId,
      status: "active",
      properties: { dose: parsed.data.dose ?? null, horarios: parsed.data.horarios, stock: parsed.data.stock } as unknown as Json,
    })
    .select("id")
    .single();
  if (error || !data) return fail("Não foi possível criar o remédio.");

  if (parsed.data.horarios.length > 0) {
    const timezone = await getUserTimezone(supabase, user.id);
    await scheduleMedicationReminders(supabase, user.id, data.id, parsed.data.title, parsed.data.dose, parsed.data.horarios, timezone);
  }

  revalidatePath("/hoje");
  return ok({ id: data.id });
}

/** Horários do remédio (10.5) — grava em `properties.horarios` e refaz os avisos de dose. */
export async function setMedicationSchedule(itemId: string, horarios: unknown): Promise<Result<null>> {
  const parsed = setMedicationScheduleSchema.safeParse({ horarios });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Horários inválidos.");

  const { supabase, user } = await requireOwner();
  const { data: item } = await supabase.from("items").select("title, properties").eq("id", itemId).eq("owner_id", user.id).maybeSingle();
  if (!item) return fail("Remédio não encontrado.");

  const properties: Record<string, unknown> = { ...((item.properties as Record<string, unknown> | null) ?? {}), horarios: parsed.data.horarios };
  const { error } = await supabase.from("items").update({ properties: properties as unknown as Json }).eq("id", itemId).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  const timezone = await getUserTimezone(supabase, user.id);
  const dose = typeof properties.dose === "string" ? properties.dose : undefined;
  const scheduled = await scheduleMedicationReminders(supabase, user.id, itemId, item.title || "Remédio", dose, parsed.data.horarios, timezone);

  revalidatePath("/hoje");
  if (!scheduled) return fail("Os horários foram salvos, mas não consegui agendar os avisos. Tente salvar de novo.");
  return ok(null);
}

/** Estoque do remédio (10.5) — edição manual, fora do "Tomei" (que desconta 1 automaticamente). */
export async function setMedicationStock(itemId: string, stock: unknown): Promise<Result<null>> {
  const parsed = setMedicationStockSchema.safeParse({ stock });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Estoque inválido.");

  const { supabase, user } = await requireOwner();
  const { data: item } = await supabase.from("items").select("properties").eq("id", itemId).eq("owner_id", user.id).maybeSingle();
  if (!item) return fail("Remédio não encontrado.");

  const properties = { ...((item.properties as Record<string, unknown> | null) ?? {}), stock: parsed.data.stock };
  const { error } = await supabase.from("items").update({ properties: properties as unknown as Json }).eq("id", itemId).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/hoje");
  return ok(null);
}

export interface TakeDoseResult {
  stock: number | null;
  lowStock: boolean;
  addedToShoppingList: boolean;
}

/** "Tomei" (10.5): desconta 1 do estoque; abaixo de 5 dias restantes, soma na lista de compras. */
export async function takeMedicationDose(itemId: string): Promise<Result<TakeDoseResult>> {
  const { supabase, user } = await requireOwner();

  const { data: item } = await supabase.from("items").select("title, properties").eq("id", itemId).eq("owner_id", user.id).maybeSingle();
  if (!item) return fail("Remédio não encontrado.");

  const properties = (item.properties as Record<string, unknown> | null) ?? {};
  const currentStock = typeof properties.stock === "number" ? properties.stock : null;
  const nextStock = currentStock == null ? null : Math.max(0, currentStock - 1);

  const { error } = await supabase
    .from("items")
    .update({ properties: { ...properties, stock: nextStock } as unknown as Json })
    .eq("id", itemId)
    .eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);

  // Log com hora (10.16) — sem isso não dava pra saber quantas doses de
  // verdade foram tomadas numa semana, só o estoque atual.
  await supabase.from("medication_dose_logs").insert({ owner_id: user.id, item_id: itemId });

  let lowStock = false;
  let addedToShoppingList = false;
  if (nextStock != null) {
    const horarios = Array.isArray(properties.horarios) ? properties.horarios.filter((h): h is string => typeof h === "string") : [];
    const daysLeft = daysUntilEmpty(nextStock, dosesPerDay(horarios));
    lowStock = isLowStock(daysLeft);
    if (lowStock) addedToShoppingList = await addMedicationToShoppingList(supabase, user.id, item.title || "Remédio");
  }

  revalidatePath("/hoje");
  return ok({ stock: nextStock, lowStock, addedToShoppingList });
}

/** "Excluir remédio" direto no card do Hoje — exclusão lógica, igual a qualquer item (vai pra lixeira). */
export async function deleteMedication(itemId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase.from("items").update({ deleted_at: new Date().toISOString() }).eq("id", itemId).eq("owner_id", user.id);
  if (error) return fail("Não foi possível excluir o remédio.");

  revalidatePath("/hoje");
  return ok(null);
}
