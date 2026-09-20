import type { JSONContent } from "@tiptap/core";
import { markdownToTiptapDoc } from "@/features/items/lib/markdown-to-tiptap";

export interface PreviousMeetingSummary {
  id: string;
  title: string;
  pendingActions: { id: string; title: string }[];
}

/**
 * Conteúdo inicial da nota de reunião (3.7): o template do tipo "Reunião"
 * (se o dono configurou um) primeiro, depois o link do Meet (se o evento
 * tiver um) e a seção "Última reunião com estes participantes" (se achou
 * uma anterior com participante em comum).
 */
export function buildMeetingNoteContent(
  typeTemplate: JSONContent | null,
  meetUrl: string | null,
  previousMeeting: PreviousMeetingSummary | null,
): JSONContent {
  const blocks: JSONContent[] = [...(typeTemplate?.content ?? [])];

  if (meetUrl) {
    blocks.push({
      type: "paragraph",
      content: [{ type: "text", marks: [{ type: "link", attrs: { href: meetUrl } }], text: meetUrl }],
    });
  }

  if (previousMeeting) {
    blocks.push(
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Última reunião com estes participantes" }] },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            marks: [{ type: "link", attrs: { href: `/itens/${previousMeeting.id}` } }],
            text: previousMeeting.title,
          },
        ],
      },
    );
    if (previousMeeting.pendingActions.length > 0) {
      const bullets = previousMeeting.pendingActions.map((action) => `- ${action.title}`).join("\n");
      blocks.push(...(markdownToTiptapDoc(bullets).content ?? []));
    }
  }

  return { type: "doc", content: blocks.length > 0 ? blocks : [{ type: "paragraph", content: [] }] };
}
