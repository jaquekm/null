import { Bell, CalendarClock, CircleDollarSign, DatabaseBackup, Download, FileScan, KeyRound, Keyboard, Link2, ListChecks, Package, Plug, Shapes, Shield, Smartphone, Sparkles, Tag, Trash2, Wallet, Zap } from "lucide-react";
import Link from "next/link";
import { countFailedJobs } from "@/features/jobs/queries";
import { requireOwner } from "@/lib/auth";

export default async function ConfiguracoesPage() {
  const { supabase } = await requireOwner();
  const failedJobs = await countFailedJobs(supabase);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Configurações
      </h1>

      <Link
        href="/configuracoes/tipos"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Shapes className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Tipos de objeto</p>
          <p className="text-zinc-500 dark:text-zinc-400">Campos, visão padrão, template de título</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/automacoes"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Zap className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Automações</p>
          <p className="text-zinc-500 dark:text-zinc-400">Quando/Se/Então, testar, histórico de execuções</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/metodos"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Package className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Métodos (packs)</p>
          <p className="text-zinc-500 dark:text-zinc-400">Instalar, atualizar e desinstalar pacotes de método</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/seguranca"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Shield className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Segurança</p>
          <p className="text-zinc-500 dark:text-zinc-400">
            Senha, autenticação em duas etapas, sessões
          </p>
        </div>
      </Link>

      <Link
        href="/configuracoes/tags"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Tag className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Tags</p>
          <p className="text-zinc-500 dark:text-zinc-400">Renomear, mesclar, excluir</p>
        </div>
      </Link>

      <Link
        href="/financas/configurar"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Wallet className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Finanças</p>
          <p className="text-zinc-500 dark:text-zinc-400">Contas, cartões, categorias e chaves Pix</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/tokens"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <KeyRound className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Tokens de API</p>
          <p className="text-zinc-500 dark:text-zinc-400">Criar, listar e revogar tokens</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/backup"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <DatabaseBackup className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Backup</p>
          <p className="text-zinc-500 dark:text-zinc-400">Status dos backups e do teste de restauração</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/dados"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Download className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Dados</p>
          <p className="text-zinc-500 dark:text-zinc-400">Export completo em .zip — Markdown, CSVs, ICS, vCard</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/mcp"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Plug className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Servidor MCP</p>
          <p className="text-zinc-500 dark:text-zinc-400">Conectar Claude Code e outros clientes MCP</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/captura"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Smartphone className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Bookmarklet e atalho do iOS</p>
          <p className="text-zinc-500 dark:text-zinc-400">Capturar sem abrir o Hub primeiro</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/atalhos"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Keyboard className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Atalhos de teclado</p>
          <p className="text-zinc-500 dark:text-zinc-400">Paleta de comandos (Ctrl/Cmd+K) e outros atalhos</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/jobs"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <ListChecks className="h-5 w-5 shrink-0" />
        <div className="flex-1">
          <p className="flex items-center gap-2 font-medium text-black dark:text-zinc-50">
            Jobs
            {failedJobs > 0 && (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-normal text-red-700 dark:bg-red-950 dark:text-red-300">
                {failedJobs} com falha
              </span>
            )}
          </p>
          <p className="text-zinc-500 dark:text-zinc-400">Fila de tarefas em segundo plano, tentativas e erros</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/uso"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <CircleDollarSign className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Uso e custo</p>
          <p className="text-zinc-500 dark:text-zinc-400">Gasto do mês por provedor e recurso, orçamento de IA</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/integracoes"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <CalendarClock className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Integrações</p>
          <p className="text-zinc-500 dark:text-zinc-400">Conexão com o Google Calendar</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/midia"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <FileScan className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Mídia</p>
          <p className="text-zinc-500 dark:text-zinc-400">OCR automático de imagens e PDFs escaneados</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/ia"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Sparkles className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">IA</p>
          <p className="text-zinc-500 dark:text-zinc-400">Espaços indexados, finanças/contatos, reindexar tudo</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/compartilhamentos"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Link2 className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Compartilhamentos</p>
          <p className="text-zinc-500 dark:text-zinc-400">Links públicos de itens, visualizações e revogar</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/notificacoes"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Bell className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Notificações</p>
          <p className="text-zinc-500 dark:text-zinc-400">Push neste dispositivo e avisos ao dono</p>
        </div>
      </Link>

      <Link
        href="/configuracoes/lixeira"
        className="flex items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Trash2 className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Lixeira</p>
          <p className="text-zinc-500 dark:text-zinc-400">Itens excluídos, restaurar ou excluir de vez</p>
        </div>
      </Link>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Mais opções em breve.
      </p>
    </div>
  );
}
