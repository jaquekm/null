import { Shapes, Shield, Trash2 } from "lucide-react";
import Link from "next/link";

export default function ConfiguracoesPage() {
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
