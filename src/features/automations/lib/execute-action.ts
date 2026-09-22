import "server-only";
import type { JSONContent } from "@tiptap/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractText } from "@/features/items/lib/extract-text";
import { getUserTimezone } from "@/features/reminders/queries";
import { hmacSha256Hex } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";
import { notifyOwner } from "@/lib/messaging/notify-owner";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { AutomationAction } from "../schemas";
import { appendChecklistToContent } from "./build-checklist-node";
import { emitItemEvent, emitTagAddedEvent } from "./emit-item-event";
import { resolveTemplateValue } from "./resolve-template";

type Client = SupabaseClient<Database>;

export interface AutomationItemContext {
  id: string;
  typeId: string | null;
  spaceId: string | null;
  title: string;
  status: string;
  properties: Record<string, unknown>;
}

export interface ExecuteActionContext {
  supabase: Client;
  ownerId: string;
  automationId: string;
  /** `null` só pra automações de `schedule` sem item associado — ações que dependem de item falham com erro claro. */
  item: AutomationItemContext | null;
  chainId: string;
  depth: number;
}

export type ActionOutcome = { ok: true; detail?: Record<string, unknown> } | { ok: false; error: string };

const ok = (detail?: Record<string, unknown>): ActionOutcome => ({ ok: true, detail });
const fail = (error: string): ActionOutcome => ({ ok: false, error });

async function contactIdsFromField(item: AutomationItemContext, field: string | undefined): Promise<string[]> {
  if (!field) return [];
  const raw = item.properties[field];
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Executa uma ação de automação (5.3) contra o banco (cliente admin — jobs
 * rodam fora de sessão, `owner_id` sempre explícito). Ações que mudam o
 * item disparador reemitem `emitItemEvent` com o mesmo `chainId`/`depth+1`,
 * pra automações encadeadas continuarem sujeitas à proteção contra laço.
 */
export async function executeAction(action: AutomationAction, ctx: ExecuteActionContext): Promise<ActionOutcome> {
  const { supabase, ownerId } = ctx;

  switch (action.type) {
    case "set_property": {
      const item = ctx.item;
      if (!item) return fail("Ação requer um item — não se aplica a automações sem gatilho de item.");

      const value = resolveTemplateValue(action.value, { today: new Date(), item: { title: item.title, properties: item.properties } });
      const nextProperties = { ...item.properties, [action.field]: value };

      const { error } = await supabase.from("items").update({ properties: nextProperties as unknown as Json }).eq("id", item.id).eq("owner_id", ownerId);
      if (error) return fail(error.message);

      await emitItemEvent({
        ownerId,
        itemId: item.id,
        before: { status: item.status, properties: item.properties },
        after: { status: item.status, properties: nextProperties },
        chainId: ctx.chainId,
        depth: ctx.depth,
      });
      return ok({ field: action.field, value });
    }

    case "add_tag": {
      const item = ctx.item;
      if (!item) return fail("Ação requer um item.");

      const name = action.tag.trim().toLowerCase();
      if (!name) return fail("Tag vazia.");

      const { data: tag, error: tagError } = await supabase.from("tags").upsert({ owner_id: ownerId, name }, { onConflict: "owner_id,name" }).select("id").single();
      if (tagError || !tag) return fail(tagError?.message ?? "Não foi possível criar a tag.");

      const { error } = await supabase.from("item_tags").upsert({ item_id: item.id, tag_id: tag.id, owner_id: ownerId }, { onConflict: "item_id,tag_id" });
      if (error) return fail(error.message);

      await emitTagAddedEvent({ ownerId, itemId: item.id, tag: name, chainId: ctx.chainId, depth: ctx.depth });
      return ok({ tag: name });
    }

    case "remove_tag": {
      const item = ctx.item;
      if (!item) return fail("Ação requer um item.");

      const name = action.tag.trim().toLowerCase();
      const { data: tag } = await supabase.from("tags").select("id").eq("owner_id", ownerId).eq("name", name).maybeSingle();
      if (!tag) return ok({ tag: name, removed: false });

      const { error } = await supabase.from("item_tags").delete().eq("item_id", item.id).eq("tag_id", tag.id).eq("owner_id", ownerId);
      if (error) return fail(error.message);
      return ok({ tag: name, removed: true });
    }

    case "move_to_space": {
      const item = ctx.item;
      if (!item) return fail("Ação requer um item.");

      const { error } = await supabase.from("items").update({ space_id: action.spaceId }).eq("id", item.id).eq("owner_id", ownerId);
      if (error) return fail(error.message);
      return ok({ spaceId: action.spaceId });
    }

    case "create_item": {
      const item = ctx.item;
      const templateContext = item ? { title: item.title, properties: item.properties } : undefined;
      const title = resolveTemplateValue(action.title, { today: new Date(), item: templateContext }) as string;
      const properties = Object.fromEntries(
        Object.entries(action.properties ?? {}).map(([key, value]) => [key, resolveTemplateValue(value, { today: new Date(), item: templateContext })]),
      );

      const { data: created, error } = await supabase
        .from("items")
        .insert({
          owner_id: ownerId,
          type_id: action.typeId,
          space_id: item?.spaceId ?? null,
          parent_id: action.parent && item ? item.id : null,
          title,
          status: "active",
          properties: properties as unknown as Json,
          source: "automation",
        })
        .select("id, status, properties")
        .single();
      if (error || !created) return fail(error?.message ?? "Não foi possível criar o item.");

      if (action.linkToTrigger && item) {
        await supabase.from("links").insert({ owner_id: ownerId, source_id: created.id, target_id: item.id, kind: "mention" });
      }

      await emitItemEvent({
        ownerId,
        itemId: created.id,
        before: null,
        after: { status: created.status, properties: (created.properties as Record<string, unknown> | null) ?? {} },
        chainId: ctx.chainId,
        depth: ctx.depth,
      });
      return ok({ createdItemId: created.id });
    }

    case "create_checklist": {
      const item = ctx.item;
      if (!item) return fail("Ação requer um item.");

      const { data: row } = await supabase.from("items").select("content").eq("id", item.id).maybeSingle();
      const nextContent = appendChecklistToContent((row?.content as JSONContent | null) ?? null, action.items);

      const { error } = await supabase
        .from("items")
        .update({ content: nextContent as unknown as Json, content_text: extractText(nextContent) })
        .eq("id", item.id)
        .eq("owner_id", ownerId);
      if (error) return fail(error.message);
      return ok({ items: action.items.length });
    }

    case "create_reminder": {
      const item = ctx.item;
      if (!item) return fail("Ação requer um item.");

      const contactIds = action.recipient === "contact_field" ? await contactIdsFromField(item, action.field) : [];
      if (action.recipient === "contact_field" && contactIds.length === 0) return fail("Campo de contato vazio — nenhum lembrete criado.");

      const timezone = await getUserTimezone(supabase, ownerId);
      const sendAt = new Date(Date.now() + action.offsetMinutes * 60_000);

      const { error } = await supabase.from("reminders").insert({
        owner_id: ownerId,
        title: item.title,
        message_template: action.message,
        channel: "auto",
        recipient_type: action.recipient === "me" ? "me" : "contacts",
        contact_ids: contactIds,
        send_at: sendAt.toISOString(),
        timezone,
        source_type: "automation",
        source_id: ctx.automationId,
        item_id: item.id,
        variables: {} as unknown as Json,
      });
      if (error) return fail(error.message);
      return ok({ sendAt: sendAt.toISOString() });
    }

    case "notify_me": {
      const templateContext = ctx.item ? { title: ctx.item.title, properties: ctx.item.properties } : undefined;
      const title = resolveTemplateValue(action.title, { today: new Date(), item: templateContext }) as string;
      const body = resolveTemplateValue(action.body, { today: new Date(), item: templateContext }) as string;
      await notifyOwner(ownerId, { title, text: body });
      return ok();
    }

    case "create_bill": {
      const item = ctx.item;
      if (!item) return fail("Ação requer um item.");

      const amountRaw = item.properties[action.amountField];
      const amountCents = typeof amountRaw === "number" ? Math.round(amountRaw) : NaN;
      if (!Number.isFinite(amountCents) || amountCents <= 0) return fail(`Campo "${action.amountField}" não tem um valor válido pra criar a conta.`);

      const dueOn = new Date();
      dueOn.setDate(dueOn.getDate() + action.dueInDays);
      const contactIds = await contactIdsFromField(item, action.contactField);
      const description = resolveTemplateValue(action.description, { today: new Date(), item: { title: item.title, properties: item.properties } }) as string;

      const { error } = await supabase.from("fin_bills").insert({
        owner_id: ownerId,
        direction: action.direction,
        description,
        amount_cents: amountCents,
        due_on: dueOn.toISOString().slice(0, 10),
        contact_id: contactIds[0] ?? null,
        item_id: item.id,
      });
      if (error) return fail(error.message);
      return ok({ amountCents, dueOn: dueOn.toISOString().slice(0, 10) });
    }

    case "create_review_cards": {
      const item = ctx.item;
      if (!item) return fail("Ação requer um item.");

      const [{ data: asSource }, { data: asTarget }] = await Promise.all([
        supabase.from("links").select("target_id").eq("source_id", item.id),
        supabase.from("links").select("source_id").eq("target_id", item.id),
      ]);
      const linkedItemIds = new Set<string>();
      for (const link of asSource ?? []) linkedItemIds.add(link.target_id);
      for (const link of asTarget ?? []) linkedItemIds.add(link.source_id);

      let created = 0;
      for (const linkedItemId of linkedItemIds) {
        const { error } = await supabase.from("review_cards").insert({ owner_id: ownerId, item_id: linkedItemId, deck_item_id: item.id });
        if (!error) created += 1;
        // 23505 (já existe card pra esse item) é esperado — idempotente, não é falha.
      }
      return ok({ created, candidates: linkedItemIds.size });
    }

    case "call_webhook": {
      const allowedUrl = serverEnv.AUTOMATION_WEBHOOK_URL;
      const secret = serverEnv.N8N_WEBHOOK_SECRET;
      if (!allowedUrl || action.url !== allowedUrl) return fail("URL de webhook não está na lista permitida (AUTOMATION_WEBHOOK_URL).");
      if (!secret) return fail("Webhook de automações não configurado (falta N8N_WEBHOOK_SECRET).");

      const body = JSON.stringify({
        automationId: ctx.automationId,
        itemId: ctx.item?.id ?? null,
        item: ctx.item ? { title: ctx.item.title, properties: ctx.item.properties } : null,
      });
      const signature = hmacSha256Hex(secret, body);

      const response = await fetch(allowedUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Hub-Signature": signature },
        body,
      });
      if (!response.ok) return fail(`Webhook respondeu ${response.status}.`);
      return ok();
    }

    default: {
      const exhaustive: never = action;
      return fail(`Ação desconhecida: ${String((exhaustive as { type?: string })?.type)}`);
    }
  }
}
