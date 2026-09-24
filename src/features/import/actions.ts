"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { JSONContent } from "@tiptap/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStoragePath } from "@/features/attachments/lib/build-storage-path";
import { extractText } from "@/features/items/lib/extract-text";
import { markdownToTiptapDoc } from "@/features/items/lib/markdown-to-tiptap";
import { listActiveSpaces, type SidebarSpace } from "@/features/spaces/queries";
import { listSpaceObjectTypes, type SpaceTypeOption } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Database, Json } from "@/lib/supabase/database.types";
import { findDuplicateCandidates } from "./lib/detect-duplicates";
import { parseGoogleKeepExport } from "./lib/parse-google-keep";
import { parseEnex } from "./lib/parse-enex";
import { parseIcsEvents, type ParsedIcsEvent } from "./lib/parse-ics";
import { parseObsidianVault } from "./lib/parse-obsidian";
import { resolveWikilinksInDoc } from "./lib/resolve-wikilinks";
import { readZipAsText } from "./lib/unzip";
import {
  bulkUpsertTags,
  createImportedItem,
  ensureImportedCalendar,
  getImportBatch,
  insertIcsEvents,
  linkTagsToItems,
  listExistingItemsInSpace,
  saveImportBatch,
  undoIcsImportBatch,
  undoItemImportBatch,
  updateImportedItemContent,
} from "./queries";
import type { ImportSource, ParsedImportAttachment, ParsedImportResult } from "./types";

type Client = SupabaseClient<Database>;

const sourceSchema = z.enum(["evernote", "obsidian", "google_keep"]);

async function parseUploadedFile(source: ImportSource, file: File): Promise<ParsedImportResult> {
  const isZip = file.name.toLowerCase().endsWith(".zip");

  if (source === "evernote") return parseEnex(await file.text());

  if (source === "obsidian") {
    const entries = isZip ? await readZipAsText(await file.arrayBuffer()) : [{ path: file.name, content: await file.text() }];
    return parseObsidianVault(entries);
  }

  const entries = isZip ? await readZipAsText(await file.arrayBuffer()) : [{ path: file.name, content: await file.text() }];
  return parseGoogleKeepExport(entries);
}

function jsonRecordFromFormData(value: FormDataEntryValue | null): Record<string, string> {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function jsonArrayFromFormData(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Dados pra montar os passos "Destino"/"Escolher origem" do assistente (7.5) — espaços do dono, sem depender de nenhum item ainda existir. */
export async function listImportSpaces(): Promise<SidebarSpace[]> {
  const { supabase } = await requireOwner();
  return listActiveSpaces(supabase);
}

export async function listImportSpaceTypes(spaceId: string): Promise<SpaceTypeOption[]> {
  const { supabase } = await requireOwner();
  return listSpaceObjectTypes(supabase, spaceId);
}

export interface ImportPreviewItem {
  localId: string;
  title: string;
  tags: string[];
  createdAt: string | null;
  attachmentCount: number;
}

export interface ImportPreviewResult {
  items: ImportPreviewItem[];
  distinctTags: string[];
  warnings: string[];
}

/** Passo "Pré-visualização" (7.5) — só lê e interpreta o arquivo, não grava nada ainda. */
export async function previewImport(formData: FormData): Promise<Result<ImportPreviewResult>> {
  await requireOwner();
  const source = sourceSchema.safeParse(formData.get("source"));
  if (!source.success) return fail("Origem inválida.");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Selecione um arquivo.");

  let parsed: ParsedImportResult;
  try {
    parsed = await parseUploadedFile(source.data, file);
  } catch {
    return fail("Não consegui ler esse arquivo — confira se o formato bate com a origem escolhida.");
  }
  if (parsed.items.length === 0) return fail(parsed.warnings[0] ?? "Nenhum item encontrado nesse arquivo.");

  return ok({
    items: parsed.items.map((i) => ({ localId: i.localId, title: i.title, tags: i.tags, createdAt: i.createdAt, attachmentCount: i.attachments.length })),
    distinctTags: [...new Set(parsed.items.flatMap((i) => i.tags))].sort(),
    warnings: parsed.warnings,
  });
}

/** Passo "Detecção de duplicados" (7.5) — roda de novo sempre que o espaço de destino muda. */
export async function checkDuplicateItems(
  items: { localId: string; title: string; createdAt: string | null }[],
  spaceId: string | null,
): Promise<Result<string[]>> {
  const { supabase, user } = await requireOwner();
  const existing = await listExistingItemsInSpace(supabase, user.id, spaceId);
  return ok(findDuplicateCandidates(items, existing).map((m) => m.localId));
}

async function uploadImportedAttachment(supabase: Client, ownerId: string, itemId: string, attachment: ParsedImportAttachment): Promise<void> {
  const storagePath = buildStoragePath(ownerId, itemId, randomUUID(), attachment.fileName);
  const { error: uploadError } = await supabase.storage.from("attachments").upload(storagePath, Buffer.from(attachment.data), { contentType: attachment.mimeType });
  if (uploadError) return; // melhor esforço — um anexo que falha não derruba o resto do item importado

  await supabase.from("attachments").insert({
    owner_id: ownerId,
    item_id: itemId,
    storage_path: storagePath,
    file_name: attachment.fileName,
    mime_type: attachment.mimeType,
    size_bytes: attachment.data.byteLength,
  });
}

export interface ImportCommitResult {
  batchId: string;
  itemsCreated: number;
  itemsSkipped: number;
}

/**
 * Passo final "Confirmar" (7.5) — reprocessa o mesmo arquivo (o parser é
 * puro e determinístico, os `localId` saem sempre na mesma ordem) em vez de
 * o navegador reenviar tudo já interpretado: evita duplicar corpo de
 * texto/bytes de anexo no tráfego de rede pra cada passo do assistente.
 * `properties._import_id` em cada item criado é o que permite desfazer.
 */
export async function commitImport(formData: FormData): Promise<Result<ImportCommitResult>> {
  const { supabase, user } = await requireOwner();

  const source = sourceSchema.safeParse(formData.get("source"));
  if (!source.success) return fail("Origem inválida.");
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Selecione um arquivo.");

  const spaceId = (formData.get("spaceId") as string | null) || null;
  const typeId = (formData.get("typeId") as string | null) || null;
  const tagRename = jsonRecordFromFormData(formData.get("tagRename"));
  const excludeLocalIds = new Set(jsonArrayFromFormData(formData.get("excludeLocalIds")));

  let parsed: ParsedImportResult;
  try {
    parsed = await parseUploadedFile(source.data, file);
  } catch {
    return fail("Não consegui ler esse arquivo — confira se o formato bate com a origem escolhida.");
  }

  const itemsToImport = parsed.items.filter((i) => !excludeLocalIds.has(i.localId));
  if (itemsToImport.length === 0) return fail("Nenhum item selecionado pra importar.");

  const importBatchId = randomUUID();
  const renamedTagOf = (tag: string) => tagRename[tag] ?? tag;

  const allTagNames = itemsToImport.flatMap((i) => i.tags.map(renamedTagOf));
  const tagIdByName = await bulkUpsertTags(supabase, user.id, allTagNames);

  const createdByLocalId = new Map<string, { id: string; doc: JSONContent }>();
  for (const item of itemsToImport) {
    const doc = markdownToTiptapDoc(item.bodyMarkdown);
    const created = await createImportedItem(supabase, {
      ownerId: user.id,
      importBatchId,
      spaceId,
      typeId,
      title: item.title,
      content: doc as unknown as Json,
      contentText: extractText(doc),
      createdAt: item.createdAt,
    });
    createdByLocalId.set(item.localId, { id: created.id, doc });

    const tagLinks = item.tags
      .map(renamedTagOf)
      .map((name) => tagIdByName.get(name))
      .filter((id): id is string => Boolean(id))
      .map((tagId) => ({ itemId: created.id, tagId }));
    await linkTagsToItems(supabase, user.id, tagLinks);

    for (const attachment of item.attachments) await uploadImportedAttachment(supabase, user.id, created.id, attachment);
  }

  // Segunda passada: resolve [[wikilinks]] contra os itens deste lote + os já existentes no espaço de destino.
  const existingInSpace = await listExistingItemsInSpace(supabase, user.id, spaceId);
  const titleToId = new Map<string, string>();
  for (const existing of existingInSpace) titleToId.set(existing.title.trim().toLowerCase(), existing.id);
  for (const item of itemsToImport) {
    const created = createdByLocalId.get(item.localId);
    if (created) titleToId.set(item.title.trim().toLowerCase(), created.id);
  }

  for (const item of itemsToImport) {
    const created = createdByLocalId.get(item.localId);
    if (!created || !item.bodyMarkdown.includes("[[")) continue;
    const resolvedDoc = resolveWikilinksInDoc(created.doc, titleToId);
    await updateImportedItemContent(supabase, created.id, resolvedDoc as unknown as Json, extractText(resolvedDoc));
  }

  const itemsSkipped = parsed.items.length - itemsToImport.length;
  await saveImportBatch(supabase, {
    ownerId: user.id,
    id: importBatchId,
    source: source.data,
    itemsCreated: createdByLocalId.size,
    itemsSkipped,
    detail: { warnings: parsed.warnings } as unknown as Json,
  });

  revalidatePath("/configuracoes/importar");
  return ok({ batchId: importBatchId, itemsCreated: createdByLocalId.size, itemsSkipped });
}

export async function undoImportBatchAction(batchId: string): Promise<Result<{ removed: number; kept: number }>> {
  const { supabase, user } = await requireOwner();
  const batch = await getImportBatch(supabase, user.id, batchId);
  if (!batch) return fail("Lote de importação não encontrado.");
  if (batch.status === "undone") return fail("Este lote já foi desfeito.");

  const result = await undoItemImportBatch(supabase, user.id, batchId, batch.createdAt);
  revalidatePath("/configuracoes/importar");
  return ok(result);
}

/** `.ics` (7.5, "somente leitura") — fluxo à parte: cria eventos, não itens, então não passa pelo motor de import genérico acima. */
export async function previewIcsImport(formData: FormData): Promise<Result<{ events: ParsedIcsEvent[]; warnings: string[] }>> {
  await requireOwner();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Selecione um arquivo .ics.");

  const { events, warnings } = parseIcsEvents(await file.text());
  if (events.length === 0) return fail(warnings[0] ?? "Nenhum evento encontrado nesse arquivo.");
  return ok({ events, warnings });
}

export async function commitIcsImport(formData: FormData): Promise<Result<{ batchId: string; eventsCreated: number }>> {
  const { supabase, user } = await requireOwner();
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Selecione um arquivo .ics.");

  const { events } = parseIcsEvents(await file.text());
  if (events.length === 0) return fail("Nenhum evento pra importar.");

  const calendarId = await ensureImportedCalendar(supabase, user.id);
  const eventIds = await insertIcsEvents(
    supabase,
    events.map((e) => ({ ownerId: user.id, calendarId, ...e })),
  );

  const batchId = randomUUID();
  await saveImportBatch(supabase, { ownerId: user.id, id: batchId, source: "ics", itemsCreated: eventIds.length, itemsSkipped: 0, detail: { eventIds } as unknown as Json });

  revalidatePath("/configuracoes/importar");
  return ok({ batchId, eventsCreated: eventIds.length });
}

export async function undoIcsImportAction(batchId: string): Promise<Result<{ removed: number }>> {
  const { supabase, user } = await requireOwner();
  const batch = await getImportBatch(supabase, user.id, batchId);
  if (!batch) return fail("Lote não encontrado.");
  if (batch.status === "undone") return fail("Este lote já foi desfeito.");

  const removed = await undoIcsImportBatch(supabase, user.id, batch);
  revalidatePath("/configuracoes/importar");
  return ok({ removed });
}
