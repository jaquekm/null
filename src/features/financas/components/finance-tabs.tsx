"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/financas", label: "Painel" },
  { href: "/financas/lancamentos", label: "Lançamentos" },
  { href: "/financas/contas", label: "Contas" },
  { href: "/financas/orcamento", label: "Orçamento" },
  { href: "/financas/dividir", label: "Dividir" },
  { href: "/financas/recorrencias", label: "Recorrências" },
  { href: "/financas/importar", label: "Importar" },
  { href: "/financas/regras", label: "Regras" },
];

/** Navegação entre as páginas de Finanças — sem isso, só dava pra chegar em `/financas/lancamentos` etc. digitando a URL. */
export function FinanceTabs() {
  const pathname = usePathname();
  if (pathname === "/financas/configurar") return null;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-black/[.08] px-6 pt-2 dark:border-white/[.08]">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
              active
                ? "border-black font-medium text-black dark:border-zinc-50 dark:text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
