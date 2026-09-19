import type { MeetingSummary } from "@/features/media/schemas";

/** "Copiar resumo em Markdown" (2.8) — mesmas seções do bloco "Resumo gerado" (2.7), em Markdown puro. */
export function summaryToMarkdown(summary: MeetingSummary): string {
  const parts: string[] = [`# ${summary.titulo_sugerido}`, "", summary.resumo];

  if (summary.topicos.length > 0) {
    parts.push("", "## Tópicos");
    for (const topico of summary.topicos) {
      parts.push("", `### ${topico.inicio ? `${topico.titulo} (${topico.inicio})` : topico.titulo}`);
      for (const ponto of topico.pontos) parts.push(`- ${ponto}`);
    }
  }

  if (summary.decisoes.length > 0) {
    parts.push("", "## Decisões");
    for (const decisao of summary.decisoes) parts.push(`- ${decisao}`);
  }

  if (summary.acoes.length > 0) {
    parts.push("", "## Ações");
    for (const acao of summary.acoes) {
      const extras = [acao.responsavel, acao.prazo ? `prazo ${acao.prazo}` : null].filter(Boolean).join(", ");
      parts.push(`- [ ] ${acao.descricao}${extras ? ` (${extras})` : ""}`);
    }
  }

  if (summary.perguntas_em_aberto.length > 0) {
    parts.push("", "## Perguntas em aberto");
    for (const pergunta of summary.perguntas_em_aberto) parts.push(`- ${pergunta}`);
  }

  return parts.join("\n");
}
