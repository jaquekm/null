import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ZipArchive } from "archiver";
import { chunkProperties, type PropertyResolutionMaps } from "@/features/ai/lib/chunking";
import { listCategories } from "@/features/financas/queries";
import { listAccounts, listBills, listSplits, listSplitSharesForSplits } from "@/features/financas/queries";
import { buildAccountsCsv, buildBillsCsv, buildSplitsCsv } from "@/features/export/lib/build-financas";
import { buildContactsCsv, buildContactsVCard } from "@/features/export/lib/build-contacts";
import { buildEventsIcs } from "@/features/export/lib/build-events-ics";
import { buildFlashcardsCsv } from "@/features/export/lib/build-flashcards-csv";
import { buildItemMarkdown, itemFileSlug } from "@/features/export/lib/build-item-markdown";
import { buildExportReadme } from "@/features/export/lib/build-readme";
import { buildTransactionsCsv } from "@/features/financas/lib/export-csv";
import {
  dumpOwnerTable,
  listAllTransactionsForExport,
  listAttachmentsForExport,
  listCanvasesForExport,
  listContactsForExport,
  listEventsForExport,
  listFlashcardsForExport,
  listItemsForExport,
  listOutgoingLinkTitlesByItemIds,
  listTranscriptsForExport,
  RAW_DUMP_TABLES,
} from "@/features/export/queries";
import { exportAsMarkdown } from "@/features/transcripts/lib/export-transcript";
import { tiptapDocToMarkdown } from "@/features/items/lib/tiptap-to-markdown";
import { listTagsByItemIds } from "@/features/tags/queries";
import { getStudyTypeIds } from "@/features/study/queries";
import { slugify } from "@/lib/slugify";
import { notifyOwner } from "@/lib/messaging/notify-owner";
import { recordBackupRun } from "@/features/ops/queries";
import type { JSONContent } from "@tiptap/core";
import type { Segment } from "@/lib/transcription/types";
import type { JobHandler } from "../types";

const SIGNED_URL_SECONDS = 24 * 60 * 60;

function folderSlug(name: string | null, fallback: string): string {
  if (!name) return fallback;
  return slugify(name) || fallback;
}

/**
 * Job `export_all` (7.4): monta um `.zip` com todos os dados do dono
 * (Markdown por item, anexos, transcrições, canvas, contatos, finanças,
 * flashcards, agenda, configuração e um dump JSON cru de cada tabela) e
 * sobe pro Storage com link assinado de 24h. Escreve num arquivo temporário
 * em disco (`archiver` → `fs.createWriteStream`) em vez de acumular tudo em
 * memória — só o zip finalizado é lido de volta pra fazer o upload (a API
 * do Storage não aceita stream, só Buffer/Blob, mesma limitação de
 * `generate-report.ts`, 6.4).
 */
export const exportAll: JobHandler = async (job, { supabase }) => {
  const ownerId = job.owner_id;
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const rootFolder = `hub-export-${dateStr}`;

  const tmpDir = await mkdtemp(path.join(tmpdir(), "hub-export-"));
  const zipPath = path.join(tmpDir, `${rootFolder}.zip`);

  try {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const output = createWriteStream(zipPath);
    const closed = new Promise<void>((resolve, reject) => {
      output.on("close", resolve);
      archive.on("error", reject);
    });
    archive.pipe(output);

    archive.append(buildExportReadme(today.toISOString()), { name: `${rootFolder}/README.md` });

    // --- Itens (Markdown com front matter + [[wikilinks]]) ---
    const items = await listItemsForExport(supabase, ownerId);
    const itemIds = items.map((i) => i.id);
    const [linkTitlesByItem, tagsByItem, allContacts] = await Promise.all([
      listOutgoingLinkTitlesByItemIds(supabase, ownerId, itemIds),
      listTagsByItemIds(supabase, itemIds),
      listContactsForExport(supabase, ownerId),
    ]);

    const maps: PropertyResolutionMaps = {
      contactNames: new Map(),
      itemTitles: new Map(items.map((i) => [i.id, i.title])),
    };
    // `ExportContactRow` não tem `id` (é só pra CSV/vCard) — resolve nomes de contato nas propriedades a partir da tabela crua.
    const { data: contactIdRows } = await supabase.from("contacts").select("id, name").eq("owner_id", ownerId);
    for (const c of contactIdRows ?? []) maps.contactNames.set(c.id, c.name);

    for (const item of items) {
      const spaceFolder = folderSlug(item.spaceName, "sem-espaco");
      const typeFolder = folderSlug(item.typeName, "sem-tipo");
      const fileName = itemFileSlug(item.title, item.id);
      const tags = (tagsByItem.get(item.id) ?? []).map((t) => t.name);
      const propertyChunk = chunkProperties(item.typeFields, item.properties, maps, { includeFinanceContacts: true });
      const bodyMarkdown = tiptapDocToMarkdown((item.content as JSONContent | null) ?? null);

      const markdown = buildItemMarkdown({
        id: item.id,
        title: item.title,
        typeName: item.typeName,
        spaceName: item.spaceName,
        tags,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        propertyLines: propertyChunk ? propertyChunk.text.split("\n") : [],
        outgoingLinkTitles: linkTitlesByItem.get(item.id) ?? [],
        bodyMarkdown,
      });

      archive.append(markdown, { name: `${rootFolder}/espacos/${spaceFolder}/${typeFolder}/${fileName}` });
    }

    // --- Anexos (arquivos originais) ---
    const attachments = await listAttachmentsForExport(supabase, ownerId);
    for (const attachment of attachments) {
      const { data: file } = await supabase.storage.from("attachments").download(attachment.storagePath);
      if (!file) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      archive.append(buffer, { name: `${rootFolder}/anexos/${attachment.itemId}/${attachment.fileName}` });
    }

    // --- Transcrições ---
    const transcripts = await listTranscriptsForExport(supabase, ownerId);
    for (const transcript of transcripts) {
      const markdown = exportAsMarkdown((transcript.segments as Segment[] | null) ?? [], transcript.speakerNames);
      archive.append(markdown, { name: `${rootFolder}/transcricoes/${transcript.itemId}.md` });
    }

    // --- Canvas ---
    const canvases = await listCanvasesForExport(supabase, ownerId);
    for (const canvas of canvases) {
      archive.append(JSON.stringify({ canvas: canvas.canvas, nodes: canvas.nodes, edges: canvas.edges }, null, 2), {
        name: `${rootFolder}/canvas/${canvas.itemId}.json`,
      });
    }

    // --- Contatos ---
    archive.append(buildContactsCsv(allContacts), { name: `${rootFolder}/contatos/contatos.csv` });
    archive.append(buildContactsVCard(allContacts), { name: `${rootFolder}/contatos/contatos.vcf` });

    // --- Finanças ---
    const [accounts, categories, bills, splits] = await Promise.all([
      listAccounts(supabase),
      listCategories(supabase),
      listBills(supabase, { tab: "all" }, dateStr),
      listSplits(supabase, {}),
    ]);
    const { data: spaceRows } = await supabase.from("spaces").select("id, name").eq("owner_id", ownerId);
    const spaceNameBySpaceId = new Map((spaceRows ?? []).map((s) => [s.id, s.name]));
    const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
    const contactNameById = maps.contactNames;

    archive.append(
      buildAccountsCsv(
        accounts.map((a) => ({
          name: a.name,
          kind: a.kind,
          institution: a.institution,
          spaceName: a.spaceId ? (spaceNameBySpaceId.get(a.spaceId) ?? null) : null,
          openingBalanceCents: a.openingBalanceCents,
          openingDate: a.openingDate,
          creditLimitCents: a.creditLimitCents,
          includeInTotals: a.includeInTotals,
        })),
      ),
      { name: `${rootFolder}/financas/contas.csv` },
    );

    const transactions = await listAllTransactionsForExport(supabase, ownerId);
    archive.append("﻿" + buildTransactionsCsv(transactions), { name: `${rootFolder}/financas/lancamentos.csv` });

    archive.append(
      buildBillsCsv(
        bills.map((b) => ({
          direction: b.direction,
          description: b.description,
          contactName: b.contactId ? (contactNameById.get(b.contactId) ?? null) : null,
          categoryName: b.categoryId ? (categoryNameById.get(b.categoryId) ?? null) : null,
          accountName: b.accountId ? (accountNameById.get(b.accountId) ?? null) : null,
          amountCents: b.amountCents,
          paidCents: b.paidCents,
          dueOn: b.dueOn,
          status: b.status,
        })),
      ),
      { name: `${rootFolder}/financas/contas_a_pagar_receber.csv` },
    );

    const splitIds = splits.map((s) => s.id);
    const shares = splitIds.length > 0 ? await listSplitSharesForSplits(supabase, splitIds) : [];
    const splitById = new Map(splits.map((s) => [s.id, s]));
    archive.append(
      buildSplitsCsv(
        shares.map((share) => {
          const split = splitById.get(share.splitId)!;
          return {
            title: split.title,
            occurredOn: split.occurredOn,
            totalCents: split.totalCents,
            paidByName: split.paidByContactId ? (contactNameById.get(split.paidByContactId) ?? "") : "Eu",
            method: split.method,
            groupLabel: split.groupLabel,
            status: split.status,
            shareContactName: share.contactId ? (contactNameById.get(share.contactId) ?? "") : "Eu",
            shareCents: share.shareCents,
            settledCents: share.settledCents,
          };
        }),
      ),
      { name: `${rootFolder}/financas/divisoes.csv` },
    );

    // --- Estudos (flashcards) ---
    const studyTypeIds = await getStudyTypeIds(supabase);
    if (studyTypeIds) {
      const flashcards = await listFlashcardsForExport(supabase, ownerId, studyTypeIds.flashcardTypeId);
      archive.append(buildFlashcardsCsv(flashcards), { name: `${rootFolder}/estudos/flashcards.csv` });
    }

    // --- Agenda ---
    const events = await listEventsForExport(supabase, ownerId);
    archive.append(buildEventsIcs(events), { name: `${rootFolder}/agenda/eventos.ics` });

    // --- Configuração ---
    for (const [table, fileName] of [
      ["object_types", "tipos.json"],
      ["views", "visoes.json"],
      ["automations", "automacoes.json"],
      ["packs_installed", "packs.json"],
    ] as const) {
      const rows = await dumpOwnerTable(supabase, ownerId, table);
      archive.append(JSON.stringify(rows, null, 2), { name: `${rootFolder}/configuracao/${fileName}` });
    }

    // --- Dados brutos (dump JSON de cada tabela) ---
    for (const table of RAW_DUMP_TABLES) {
      const rows = await dumpOwnerTable(supabase, ownerId, table);
      archive.append(JSON.stringify(rows, null, 2), { name: `${rootFolder}/dados-brutos/${table}.json` });
    }

    await archive.finalize();
    await closed;

    const zipBuffer = await readFile(zipPath);
    const storagePath = `${ownerId}/exports/${rootFolder}-${randomUUID().slice(0, 8)}.zip`;

    const { error: uploadError } = await supabase.storage.from("attachments").upload(storagePath, zipBuffer, { contentType: "application/zip" });
    if (uploadError) return { status: "retry", error: uploadError.message };

    const { data: signed, error: signedError } = await supabase.storage.from("attachments").createSignedUrl(storagePath, SIGNED_URL_SECONDS, {
      download: `${rootFolder}.zip`,
    });
    if (signedError || !signed) return { status: "retry", error: signedError?.message ?? "Falha ao gerar o link de download." };

    await recordBackupRun(supabase, {
      ownerId,
      kind: "export",
      status: "success",
      sizeBytes: zipBuffer.byteLength,
      location: storagePath,
      detail: `${items.length} itens, ${attachments.length} anexos.`,
    });

    await notifyOwner(ownerId, {
      title: "Export completo pronto",
      text: `Seu export está pronto — baixe em até 24h: ${signed.signedUrl}`,
    });

    return { status: "done", result: { itemCount: items.length, sizeBytes: zipBuffer.byteLength, signedUrl: signed.signedUrl } };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
};
