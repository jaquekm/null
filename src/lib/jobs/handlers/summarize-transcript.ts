import type { JSONContent } from "@tiptap/core";
import { z } from "zod";
import { buildSummaryBlock } from "@/features/transcripts/lib/build-summary-block";
import { buildTranscriptText } from "@/features/transcripts/lib/build-transcript-text";
import { chunkText } from "@/features/transcripts/lib/chunk-text";
import { extractText } from "@/features/items/lib/extract-text";
import { meetingSummarySchema, type MeetingSummary } from "@/features/media/schemas";
import { AiBudgetExceededError, AiDisabledError, callClaude, callClaudeJson } from "@/lib/ai/claude";
import type { Json } from "@/lib/supabase/database.types";
import type { Segment } from "@/lib/transcription/types";
import type { JobHandler } from "../types";

const payloadSchema = z.object({
  transcriptId: z.string().uuid(),
  // "Gerar resumo novamente" (2.7): força regerar mesmo com `transcripts.summary`
  // já preenchido — sem essa flag, um retry do mesmo job (ex.: falha de rede
  // depois de já ter chamado a IA numa tentativa anterior) não gastaria uma
  // segunda chamada nem duplicaria o bloco no conteúdo.
  force: z.boolean().optional(),
});

const DEFAULT_TITLES = new Set(["", "Sem título"]);

/** Acima disso, divide em blocos com sobreposição antes de resumir (2.7). */
const CHUNK_MAX_CHARS = 60_000;
const CHUNK_OVERLAP_CHARS = 2_000;

const SYSTEM_PROMPT = [
  "Você resume reuniões em português do Brasil, com fidelidade ao que foi dito.",
  "Não invente decisões, prazos ou responsáveis. Use null quando não houver.",
  'Datas relativas ("sexta que vem") só viram data se a data da reunião for informada; ela será enviada no contexto.',
].join("\n");

const CHUNK_SYSTEM_PROMPT =
  "Você resume um trecho de uma transcrição de reunião em português do Brasil, com fidelidade ao que foi dito. " +
  "Preserve nomes de locutores, decisões e ações mencionadas nesse trecho — este resumo será combinado com o de " +
  "outros trechos da mesma reunião depois, então não sintetize demais.";

function buildUserMessage(transcriptText: string, meetingDateIso: string | null): string {
  const dateLine = meetingDateIso ? `Data da reunião: ${meetingDateIso}\n\n` : "";
  return `${dateLine}Transcrição da reunião, com locutor e horário de cada fala:\n\n${transcriptText}`;
}

/** Resume cada bloco (texto corrido, não JSON) e consolida — pro texto final caber numa chamada estruturada só. */
async function condenseByChunks(chunks: string[], ownerId: string, itemId: string): Promise<string> {
  const notes: string[] = [];
  for (const [index, chunk] of chunks.entries()) {
    const { text } = await callClaude({
      ownerId,
      itemId,
      feature: "meeting_summary_chunk",
      system: CHUNK_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Trecho ${index + 1} de ${chunks.length}:\n\n${chunk}` }],
    });
    notes.push(text);
  }
  return notes.map((note, index) => `Trecho ${index + 1}:\n${note}`).join("\n\n");
}

/**
 * Job `summarize_transcript` (2.7): monta o texto com locutor+horário
 * (aplicando `speaker_names`), resume em blocos se for grande demais pra uma
 * chamada só, pede o resumo estruturado (`meetingSummarySchema`), salva em
 * `transcripts.summary`, e insere um bloco "Resumo gerado" antes do
 * conteúdo existente do item (com uma versão `reason='ai'` salva antes).
 */
export const summarizeTranscript: JobHandler = async (job, { supabase }) => {
  const parsed = payloadSchema.safeParse(job.payload);
  if (!parsed.success) return { status: "failed", error: "Payload inválido — falta transcriptId." };
  const { transcriptId, force } = parsed.data;

  const { data: transcript, error: transcriptError } = await supabase
    .from("transcripts")
    .select("id, owner_id, item_id, status, text, segments, speaker_names, summary")
    .eq("id", transcriptId)
    .maybeSingle();
  if (transcriptError) return { status: "retry", error: transcriptError.message };
  if (!transcript) return { status: "failed", error: "Transcrição não encontrada." };
  if (transcript.status !== "completed" || !transcript.text) {
    return { status: "failed", error: "Transcrição ainda não concluída — nada pra resumir." };
  }
  if (transcript.summary && !force) return { status: "done" }; // já resumido, não é um pedido de regerar

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("title, content, properties")
    .eq("id", transcript.item_id)
    .maybeSingle();
  if (itemError || !item) return { status: "failed", error: "Item da reunião não encontrado." };

  const segments = (transcript.segments as unknown as Segment[] | null) ?? [];
  const speakerNames = (transcript.speaker_names as unknown as Record<string, string> | null) ?? {};
  const transcriptText = segments.length > 0 ? buildTranscriptText(segments, speakerNames) : transcript.text;

  const properties = (item.properties as Record<string, unknown> | null) ?? {};
  const meetingDateIso = typeof properties.data === "string" ? properties.data : null;

  let summary: MeetingSummary;
  try {
    const chunks = chunkText(transcriptText, CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS);
    const finalText = chunks.length > 1 ? await condenseByChunks(chunks, transcript.owner_id, transcript.item_id) : chunks[0]!;

    summary = await callClaudeJson({
      ownerId: transcript.owner_id,
      itemId: transcript.item_id,
      feature: "meeting_summary",
      system: SYSTEM_PROMPT,
      schema: meetingSummarySchema,
      messages: [{ role: "user", content: buildUserMessage(finalText, meetingDateIso) }],
    });
  } catch (err) {
    // Orçamento estourado ou módulo de IA desligado não se resolvem tentando
    // de novo (mesma regra documentada em `docs/decisoes.md` desde a 2.3) —
    // qualquer outro erro (rede, 5xx da API) sobe e vira `retry` no `runJob`.
    if (err instanceof AiBudgetExceededError || err instanceof AiDisabledError) {
      return { status: "failed", error: err.message };
    }
    throw err;
  }

  const { error: summaryUpdateError } = await supabase
    .from("transcripts")
    .update({ summary: summary as unknown as Json })
    .eq("id", transcriptId);
  if (summaryUpdateError) return { status: "retry", error: summaryUpdateError.message };

  const { error: versionError } = await supabase.from("item_versions").insert({
    owner_id: transcript.owner_id,
    item_id: transcript.item_id,
    title: item.title,
    content: item.content,
    properties: item.properties,
    reason: "ai",
  });
  if (versionError) return { status: "retry", error: versionError.message };

  const existingContent = (item.content as unknown as JSONContent | null) ?? null;
  const newContent: JSONContent = {
    type: "doc",
    content: [...buildSummaryBlock(summary), ...(existingContent?.content ?? [])],
  };
  const newTitle = DEFAULT_TITLES.has(item.title.trim()) ? summary.titulo_sugerido : item.title;

  const { error: contentUpdateError } = await supabase
    .from("items")
    .update({
      content: newContent as unknown as Json,
      content_text: extractText(newContent),
      title: newTitle,
    })
    .eq("id", transcript.item_id);
  if (contentUpdateError) return { status: "retry", error: contentUpdateError.message };

  return { status: "done" };
};
