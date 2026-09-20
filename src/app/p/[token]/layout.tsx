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
      <footer className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-600">Compartilhado via Hub</footer>
    </div>
  );
}
