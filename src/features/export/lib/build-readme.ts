/** `README.md` do export completo (7.4) — explica a estrutura de pastas do zip. */
export function buildExportReadme(generatedAt: string): string {
  return `# Export do Hub — ${generatedAt}

Este arquivo é um export completo dos seus dados, gerado pelo botão
"Exportar tudo" em Configurações → Dados.

## Estrutura

- \`espacos/<espaço>/<tipo>/<titulo>--<id>.md\`: cada item, em Markdown com
  front matter YAML (id, tipo, espaço, tags, status, datas, propriedades) e
  links pra outros itens como \`[[titulo]]\` — compatível com o Obsidian
  (abra esta pasta como um vault).
- \`anexos/<item-id>/<arquivo>\`: anexos originais de cada item.
- \`transcricoes/<item-id>.md\`: transcrições de áudio/vídeo, com locutor e
  tempo de cada trecho.
- \`canvas/<item-id>.json\`: quadros (canvas) com nós e conexões.
- \`contatos/contatos.csv\` e \`contatos/contatos.vcf\`: sua lista de contatos
  (o \`.vcf\` importa direto no Google Contatos, iPhone etc.).
- \`financas/*.csv\`: contas, lançamentos, contas a pagar/receber e divisões.
- \`estudos/flashcards.csv\`: seus flashcards, compatível com importação no
  Anki (\`frente;verso;baralho\`).
- \`agenda/eventos.ics\`: seus eventos, importável em qualquer app de agenda.
- \`configuracao/*.json\`: tipos de objeto, visões, automações e pacotes
  instalados — a configuração do seu sistema.
- \`dados-brutos/<tabela>.json\`: um dump JSON de cada tabela, pra quem
  preferir os dados crus a reconstruir a estrutura acima.

Todos os CSVs usam \`;\` como separador, vírgula decimal e abrem certo no
Excel (BOM UTF-8 no início do arquivo).
`;
}
