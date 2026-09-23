import "server-only";
import { z } from "zod";
import { extractText } from "@/features/items/lib/extract-text";
import { DATA_FIELD_KEY, getReuniaoType, listPendingActions, PARTICIPANTES_FIELD_KEY } from "@/features/meeting-notes/queries";
import type { JSONContent } from "@tiptap/core";
import type { ReportBlock } from "../lib/blocks";
import { baseReportParamsSchema } from "../schemas";
import type { Client, ReportContext, ReportGenerator } from "../types";

export const meetingsDigestParamsSchema = baseReportParamsSchema.extend({
  contactId: z.string().uuid().optional(),
});
export type MeetingsDigestParams = z.infer<typeof meetingsDigestParamsSchema>;

const SUMMARY_EXCERPT_LENGTH = 400;

export interface MeetingDigestRow {
  id: string;
  title: string;
  date: string | null;
  participantNames: string[];
  summaryExcerpt: string;
  pendingActions: { id: string; title: string }[];
}

export interface MeetingsDigestData {
  installed: boolean;
  meetings: MeetingDigestRow[];
}

/** "Resumo de reuniões" (6.2b) — reuniões (tipo sistema "Reunião", 1.3) do período, com um trecho do conteúdo (`extractText`, mesmo extrator da indexação/busca) e ações pendentes (`listPendingActions`, 3.7). */
export const meetingsDigestReport: ReportGenerator<MeetingsDigestParams, MeetingsDigestData> = {
  kind: "meetings_digest",
  label: "Resumo de reuniões",
  paramsSchema: meetingsDigestParamsSchema,

  async collect(ctx: ReportContext<MeetingsDigestParams>): Promise<MeetingsDigestData> {
    const { supabase, ownerId, params, start, end } = ctx;
    const reuniaoType = await getReuniaoType(supabase, ownerId);
    if (!reuniaoType) return { installed: false, meetings: [] };

    const { data } = await supabase
      .from("items")
      .select("id, title, content, properties")
      .eq("owner_id", ownerId)
      .eq("type_id", reuniaoType.id)
      .is("deleted_at", null);

    const inRange = (data ?? []).filter((row) => {
      const properties = (row.properties as Record<string, unknown> | null) ?? {};
      const date = properties[DATA_FIELD_KEY];
      if (typeof date !== "string") return false;
      if (date < start || date > end) return false;
      if (params.contactId) {
        const participants = properties[PARTICIPANTES_FIELD_KEY];
        if (!Array.isArray(participants) || !participants.includes(params.contactId)) return false;
      }
      return true;
    });

    const participantIds = [
      ...new Set(
        inRange.flatMap((row) => {
          const raw = ((row.properties as Record<string, unknown> | null) ?? {})[PARTICIPANTES_FIELD_KEY];
          return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
        }),
      ),
    ];
    const [names, pendingByMeeting] = await Promise.all([
      loadContactNames(supabase, participantIds),
      Promise.all(inRange.map((row) => listPendingActions(supabase, ownerId, row.id))),
    ]);

    const meetings: MeetingDigestRow[] = inRange
      .map((row, i) => {
        const properties = (row.properties as Record<string, unknown> | null) ?? {};
        const participants = properties[PARTICIPANTES_FIELD_KEY];
        const participantIdsForRow = Array.isArray(participants) ? participants.filter((id): id is string => typeof id === "string") : [];
        const summary = extractText((row.content as JSONContent | null) ?? null).trim();
        return {
          id: row.id,
          title: row.title || "Reunião",
          date: typeof properties[DATA_FIELD_KEY] === "string" ? (properties[DATA_FIELD_KEY] as string) : null,
          participantNames: participantIdsForRow.map((id) => names.get(id) ?? "Contato"),
          summaryExcerpt: summary.length > SUMMARY_EXCERPT_LENGTH ? `${summary.slice(0, SUMMARY_EXCERPT_LENGTH)}…` : summary,
          pendingActions: pendingByMeeting[i] ?? [],
        };
      })
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

    return { installed: true, meetings };
  },

  title() {
    return "Resumo de reuniões";
  },

  toBlocks(data): ReportBlock[] {
    if (!data.meetings.length) return [{ kind: "text", body: data.installed ? "Nenhuma reunião no período." : "O tipo Reunião não está disponível." }];
    return data.meetings.map(
      (meeting): ReportBlock => ({
        kind: "text",
        title: `${meeting.title}${meeting.date ? ` — ${meeting.date.slice(0, 10)}` : ""}`,
        body: [
          meeting.participantNames.length > 0 ? `Participantes: ${meeting.participantNames.join(", ")}` : null,
          meeting.summaryExcerpt || "Sem conteúdo registrado.",
          meeting.pendingActions.length > 0 ? `Ações em aberto: ${meeting.pendingActions.map((a) => a.title).join("; ")}` : "Sem ações em aberto.",
        ]
          .filter(Boolean)
          .join("\n"),
      }),
    );
  },
};

async function loadContactNames(supabase: Client, contactIds: string[]): Promise<Map<string, string>> {
  if (contactIds.length === 0) return new Map();
  const { data } = await supabase.from("contacts").select("id, name, nickname").in("id", contactIds);
  return new Map((data ?? []).map((row) => [row.id, row.nickname || row.name]));
}
