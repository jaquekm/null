import type { ReactNode } from "react";
import { FinanceTabs } from "@/features/financas/components/finance-tabs";

/** Abas entre Painel/Lançamentos/Contas/Orçamento/Dividir/Recorrências/Importar/Regras — antes só dava pra chegar nessas páginas digitando a URL. */
export default function FinancasLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <FinanceTabs />
      {children}
    </div>
  );
}
