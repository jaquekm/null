export const metadata = { title: "Sem conexão — Hub" };

/**
 * Fallback do service worker (`public/sw.js`, 1.12) quando a navegação falha
 * por falta de rede e a página pedida não estava no cache do "shell".
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Sem conexão</h1>
      <p className="text-zinc-500 dark:text-zinc-400">
        Não foi possível carregar esta página porque o dispositivo está offline. Tente de novo quando a conexão
        voltar.
      </p>
    </div>
  );
}
