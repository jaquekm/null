import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Layout limpo do opt-out público (3.11) — sem navegação do app. */
export default function OptOutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-600">Hub</footer>
    </div>
  );
}
