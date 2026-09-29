import { formatInTimeZone } from "date-fns-tz";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listActiveSpaces } from "@/features/spaces/queries";
import { ExtractTasksPanel } from "@/features/ai/components/extract-tasks-panel";
import { FillPropertiesPanel } from "@/features/ai/components/fill-properties-panel";
import { ItemAskPanel } from "@/features/ai/components/item-ask-panel";
import { RelatedItemsPanel } from "@/features/ai/components/related-items-panel";
import { SummarizeItemPanel } from "@/features/ai/components/summarize-item-panel";
import { listRelatedItems } from "@/features/ai/queries";
import { AttachmentList } from "@/features/attachments/components/attachment-list";
import { listItemAttachments } from "@/features/attachments/queries";
import { CanvasRefsSection } from "@/features/canvas/components/canvas-refs-section";
import { CanvasWorkspace } from "@/features/canvas/components/canvas-workspace";
import { ensureCanvas, listCanvasEdges, listCanvasesContainingItem, listCanvasNodes } from "@/features/canvas/queries";
import { listContacts } from "@/features/contacts/queries";
import { ItemFinancePanel } from "@/features/financas/components/item-finance-panel";
import { listAccounts, listBillsForItem, listCategories, listTransactionsForItem } from "@/features/financas/queries";
import { BacklinksPanel } from "@/features/items/components/backlinks-panel";
import { ItemActionsBar } from "@/features/items/components/item-actions-bar";
import { ItemEditor } from "@/features/items/components/item-editor";
import { RecordMeetingButton } from "@/features/media/components/record-meeting-button";
import { SubitemsSection } from "@/features/items/components/subitems-section";
import { StudyTimer } from "@/features/study/components/study-timer";
import { VersionsPanel } from "@/features/items/components/versions-panel";
import {
  getItemDetail,
  getParent,
  listBacklinks,
  listItemVersions,
  listObjectTypesForPicker,
  listSubitems,
} from "@/features/items/queries";
import { TagSelector } from "@/features/tags/components/tag-selector";
import { listItemTags } from "@/features/tags/queries";
import { RemindAboutButton } from "@/features/reminders/components/remind-about-button";
import { getUserTimezone } from "@/features/reminders/queries";
import { ItemShareComments } from "@/features/sharing/components/item-share-comments";
import { ShareFooter } from "@/features/sharing/components/share-footer";
import { listItemShareComments, listShareLinksForItem } from "@/features/sharing/queries";
import { MeetingSummaryActions } from "@/features/transcripts/components/meeting-summary-actions";
import { MeetingPanel } from "@/features/meeting-notes/components/meeting-panel";
import { nextStepsFromContent } from "@/features/meeting-notes/lib/next-steps";
import { listMeetingParticipants } from "@/features/meeting-notes/queries";
import { TranscriptViewer } from "@/features/transcripts/components/transcript-viewer";
import { getTranscriptForItem } from "@/features/transcripts/queries";
import { requireOwner } from "@/lib/auth";

export default async function ItemPage(props: PageProps<"/itens/[id]">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const { supabase, user } = await requireOwner();

  const item = await getItemDetail(supabase, id);
  if (!item) notFound();

  if (item.type?.slug === "canvas") {
    const canvas = await ensureCanvas(supabase, user.id, item.id);
    const [canvasNodes, canvasEdges] = await Promise.all([listCanvasNodes(supabase, canvas.id), listCanvasEdges(supabase, canvas.id)]);
    return (
      <CanvasWorkspace
        itemTitle={item.title || "Sem título"}
        canvasId={canvas.id}
        initialViewport={canvas.viewport}
        initialNodes={canvasNodes}
        initialEdges={canvasEdges}
      />
    );
  }

  const timezone = await getUserTimezone(supabase, user.id);
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

  const [
    spaces,
    types,
    subitems,
    backlinks,
    versions,
    parent,
    tags,
    attachments,
    transcript,
    shareComments,
    shareLinks,
    financeAccounts,
    financeCategories,
    financeContacts,
    itemTransactions,
    itemBills,
    canvasRefs,
    relatedItems,
  ] = await Promise.all([
    listActiveSpaces(supabase),
    listObjectTypesForPicker(supabase),
    listSubitems(supabase, item.id),
    listBacklinks(supabase, item.id),
    listItemVersions(supabase, item.id),
    item.parentId ? getParent(supabase, item.parentId) : Promise.resolve(null),
    listItemTags(supabase, item.id),
    listItemAttachments(supabase, item.id),
    getTranscriptForItem(supabase, item.id),
    listItemShareComments(supabase, item.id),
    listShareLinksForItem(supabase, item.id),
    listAccounts(supabase),
    listCategories(supabase),
    listContacts(supabase, {}),
    listTransactionsForItem(supabase, item.id),
    listBillsForItem(supabase, item.id, today),
    listCanvasesContainingItem(supabase, item.id),
    listRelatedItems(supabase, item.id),
  ]);

  // Reunião (9.3): participantes (campo `participantes`, ids de contatos) e data pro painel de envio e tarefas.
  const isMeeting = item.type?.slug === "reuniao";
  const participantIds = Array.isArray(item.properties.participantes) ? item.properties.participantes.filter((id): id is string => typeof id === "string") : [];
  const meetingParticipants = isMeeting ? await listMeetingParticipants(supabase, participantIds) : [];
  const meetingDate = typeof item.properties.data === "string" ? item.properties.data : null;
  const meetingDateLabel = meetingDate
    ? new Date(meetingDate.length === 10 ? `${meetingDate}T12:00:00Z` : meetingDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: timezone })
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        {item.space && (
          <Link
            href={`/espacos/${item.space.slug}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/[.06] bg-surface px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm hover:border-black/[.12] dark:border-white/[.08] dark:text-zinc-300 dark:hover:border-white/[.16]"
          >
            {item.space.icon ? `${item.space.icon} ` : ""}
            {item.space.name}
          </Link>
        )}
        {parent && (
          <>
            <span>/</span>
            <Link href={`/itens/${parent.id}`} className="hover:underline">
              {parent.title || "Sem título"}
            </Link>
          </>
        )}
      </div>

      <ItemEditor key={item.updatedAt} item={item} />

      {isMeeting && (
        <MeetingPanel
          itemId={item.id}
          title={item.title}
          dateLabel={meetingDateLabel}
          participants={meetingParticipants}
          nextSteps={nextStepsFromContent(item.content)}
          spaces={spaces}
          defaultSpaceId={item.space?.id ?? null}
          recorder={<RecordMeetingButton itemId={item.id} />}
        />
      )}

      {item.type?.slug && ["plano-de-estudo", "curso", "livro"].includes(item.type.slug) && <StudyTimer itemId={item.id} />}

      {item.type?.slug === "proposta" && (
        <a
          href={`/api/vendas/propostas/${item.id}/export`}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]"
        >
          Exportar proposta (HTML pra imprimir)
        </a>
      )}

      {transcript && (
        <TranscriptViewer
          transcriptId={transcript.id}
          attachmentId={transcript.attachmentId}
          status={transcript.status}
          error={transcript.error}
          segments={transcript.segments}
          speakerNames={transcript.speakerNames}
          summary={transcript.summary}
          initialSeek={typeof searchParams.t === "string" ? Number(searchParams.t) : null}
        />
      )}

      {transcript?.summary && (
        <MeetingSummaryActions
          itemId={item.id}
          transcriptId={transcript.id}
          acoes={transcript.summary.acoes}
          spaces={spaces}
          defaultSpaceId={item.space?.id ?? null}
        />
      )}

      <TagSelector itemId={item.id} tags={tags} label="Subcategorias" placeholder="+ subcategoria" />

      <div className="flex flex-wrap gap-2">
        <RemindAboutButton
          defaultTitle={item.title || "Sem título"}
          defaultTimezone={timezone}
          itemId={item.id}
          sourceType="item"
          sourceId={item.id}
        />
      </div>

      <ItemActionsBar
        itemId={item.id}
        status={item.status}
        pinned={item.pinned}
        spaceId={item.space?.id ?? null}
        typeId={item.type?.id ?? null}
        typeSlug={item.type?.slug ?? null}
        spaces={spaces}
        types={types}
      />

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-400 dark:text-zinc-500">
        <div className="flex gap-1">
          <dt>Criado:</dt>
          <dd>{new Date(item.createdAt).toLocaleString("pt-BR")}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Atualizado:</dt>
          <dd>{new Date(item.updatedAt).toLocaleString("pt-BR")}</dd>
        </div>
      </dl>

      <AttachmentList itemId={item.id} attachments={attachments} />

      <ItemFinancePanel
        itemId={item.id}
        itemTitle={item.title || "Sem título"}
        today={today}
        accounts={financeAccounts}
        categories={financeCategories}
        contacts={financeContacts}
        transactions={itemTransactions}
        bills={itemBills}
      />

      <ItemShareComments comments={shareComments} />

      <SubitemsSection parentId={item.id} spaceId={item.space?.id ?? null} subitems={subitems} />
      <BacklinksPanel backlinks={backlinks} />
      <RelatedItemsPanel itemId={item.id} relatedItems={relatedItems} />
      <ItemAskPanel itemId={item.id} relatedItemIds={relatedItems.map((related) => related.id)} />
      <SummarizeItemPanel itemId={item.id} />
      <ExtractTasksPanel itemId={item.id} />
      {item.type && <FillPropertiesPanel itemId={item.id} />}
      <CanvasRefsSection refs={canvasRefs} />
      <VersionsPanel
        itemId={item.id}
        versions={versions}
        fields={item.type?.fields ?? []}
        currentContent={item.content}
        currentProperties={item.properties}
      />

      {/* No fim da página, depois de tudo: é o último passo natural — terminei a lista, mando pra quem quer acompanhar. */}
      <ShareFooter itemId={item.id} title={item.title} isList={item.type?.slug === "lista"} links={shareLinks} />
    </div>
  );
}
