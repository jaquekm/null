export const metadata = { title: "Sem conexão — JKode" };

/**
 * Fallback do service worker (`public/sw.js`, 1.12/9.9) quando a navegação falha
 * por falta de rede e a página pedida nunca foi aberta neste aparelho.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Sem conexão</h1>
      <p className="text-zinc-500 dark:text-zinc-400">
        Esta página ainda não foi aberta neste aparelho, então não tem cópia guardada. As páginas que você já abriu
        continuam aparecendo sem internet, e o que você capturar fica guardado até a conexão voltar.
      </p>
      <a href="/hoje" className="bg-brand text-brand-fg rounded-full px-5 py-2 text-sm font-medium">
        Ir pra Hoje
      </a>
    </div>
  );
}
