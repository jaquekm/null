import { ExportAllButton } from "@/features/export/components/export-all-button";

/** `/configuracoes/dados` (7.4): export completo de todos os dados num `.zip` (Markdown, CSVs, ICS, vCard, JSON). */
export default function DataExportPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Dados</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Baixe uma cópia completa dos seus dados: itens em Markdown (compatível com Obsidian), anexos,
          transcrições, contatos, finanças, flashcards, agenda e a configuração do seu sistema. O arquivo é
          gerado em segundo plano — você recebe um aviso com o link (válido por 24h) quando estiver pronto.
        </p>
      </div>

      <ExportAllButton />
    </div>
  );
}
