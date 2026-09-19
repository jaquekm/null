import type { JSONContent } from "@tiptap/core";
import type { MeetingSummary } from "@/features/media/schemas";

function heading(level: number, text: string): JSONContent {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

function paragraph(text: string): JSONContent {
  return { type: "paragraph", content: text ? [{ type: "text", text }] : [] };
}

function bulletList(items: string[]): JSONContent {
  return { type: "bulletList", content: items.map((item) => ({ type: "listItem", content: [paragraph(item)] })) };
}

function actionLine(acao: MeetingSummary["acoes"][number]): string {
  const parts = [acao.descricao];
  if (acao.responsavel) parts.push(`(${acao.responsavel})`);
  if (acao.prazo) parts.push(`— prazo ${acao.prazo}`);
  return parts.join(" ");
}

function taskList(acoes: MeetingSummary["acoes"]): JSONContent {
  return {
    type: "taskList",
    content: acoes.map((acao) => ({
      type: "taskItem",
      attrs: { checked: false },
      content: [paragraph(actionLine(acao))],
    })),
  };
}

/**
 * Bloco "Resumo gerado" em Tiptap JSON (2.7) — nodes de topo, ainda sem o
 * `{type: 'doc', ...}` em volta, pra dar pra prefixar no `content` existente
 * do item. Ações viram checklist (`taskList`/`taskItem`, únicas extensões de
 * lista de tarefa do editor — `extensions.ts`); responsável/prazo entram
 * como texto na própria linha da ação porque o tipo "Tarefa" não tem um
 * campo de responsável pra virar propriedade estruturada.
 */
export function buildSummaryBlock(summary: MeetingSummary): JSONContent[] {
  const nodes: JSONContent[] = [heading(2, "Resumo gerado"), paragraph(summary.resumo)];

  if (summary.topicos.length > 0) {
    nodes.push(heading(3, "Tópicos"));
    for (const topico of summary.topicos) {
      nodes.push(heading(4, topico.inicio ? `${topico.titulo} (${topico.inicio})` : topico.titulo));
      if (topico.pontos.length > 0) nodes.push(bulletList(topico.pontos));
    }
  }

  if (summary.decisoes.length > 0) {
    nodes.push(heading(3, "Decisões"));
    nodes.push(bulletList(summary.decisoes));
  }

  if (summary.acoes.length > 0) {
    nodes.push(heading(3, "Ações"));
    nodes.push(taskList(summary.acoes));
  }

  if (summary.perguntas_em_aberto.length > 0) {
    nodes.push(heading(3, "Perguntas em aberto"));
    nodes.push(bulletList(summary.perguntas_em_aberto));
  }

  return nodes;
}
