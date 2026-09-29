import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Layout limpo da página pública (3.11) — sem navegação do app, com rodapé discreto. */
export default function SharePageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 flex-col">{children}</main>
      {/* Quem recebe um link conhece o sistema por aqui — não existe cadastro de terceiros, então é só uma apresentação. */}
      <footer className="mx-auto flex w-full max-w-2xl flex-col items-center gap-1 border-t border-black/[.06] px-6 py-6 text-center dark:border-white/[.08]">
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Feito com o Hub</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Um sistema pessoal de organização: notas, listas, agenda, lembretes, finanças, estudos e treinos num lugar só. Este link mostra sempre a versão mais
          recente.
        </p>
      </footer>
    </div>
  );
}
