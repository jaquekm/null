import { formatInTimeZone } from "date-fns-tz";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listActiveSpaces } from "@/features/spaces/queries";
import { AttachmentList } from "@/features/attachments/components/attachment-list";
import { listItemAttachments } from "@/features/attachments/queries";
import { listContacts } from "@/features/contacts/queries";
import { ItemFinancePanel } from "@/features/financas/components/item-finance-panel";
import { listAccounts, listBillsForItem, listCategories, listTransactionsForItem } from "@/features/financas/queries";
import { BacklinksPanel } from "@/features/items/components/backlinks-panel";
import { ItemActionsBar } from "@/features/items/components/item-actions-bar";
import { ItemEditor } from "@/features/items/components/item-editor";
import { RecordMeetingButton } from "@/features/media/components/record-meeting-button";
import { SubitemsSection } from "@/features/items/components/subitems-section";
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
import { ShareDialog } from "@/features/sharing/components/share-dialog";
import { listItemShareComments, listShareLinksForItem } from "@/features/sharing/queries";
import { MeetingSummaryActions } from "@/features/transcripts/components/meeting-summary-actions";
import { TranscriptViewer } from "@/features/transcripts/components/transcript-viewer";
import { getTranscriptForItem } from "@/features/transcripts/queries";
import { requireOwner } from "@/lib/auth";

export default async function ItemPage(props: PageProps<"/itens/[id]">) {
  const { id } = await props.params;
  const { supabase, user } = await requireOwner();

  const item = await getItemDetail(supabase, id);
  if (!item) notFound();

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
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        {item.space && (
          <Link href={`/espacos/${item.space.slug}`} className="hover:underline">
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

      {item.type?.slug === "reuniao" && <RecordMeetingButton itemId={item.id} />}

      {transcript && (
        <TranscriptViewer
          transcriptId={transcript.id}
          attachmentId={transcript.attachmentId}
          status={transcript.status}
          error={transcript.error}
          segments={transcript.segments}
          speakerNames={transcript.speakerNames}
          summary={transcript.summary}
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

      <TagSelector itemId={item.id} tags={tags} />

      <div className="flex flex-wrap gap-2">
        <RemindAboutButton
          defaultTitle={item.title || "Sem título"}
          defaultTimezone={timezone}
          itemId={item.id}
          sourceType="item"
          sourceId={item.id}
        />
        <ShareDialog itemId={item.id} links={shareLinks} />
      </div>

      <ItemActionsBar
        itemId={item.id}
        status={item.status}
        pinned={item.pinned}
        spaceId={item.space?.id ?? null}
        typeId={item.type?.id ?? null}
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
      <VersionsPanel
        itemId={item.id}
        versions={versions}
        fields={item.type?.fields ?? []}
        currentContent={item.content}
        currentProperties={item.properties}
      />
    </div>
  );
}
