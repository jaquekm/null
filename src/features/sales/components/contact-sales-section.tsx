import Link from "next/link";
import { formatBRL } from "@/lib/money";
import type { ContactSalesSummary } from "../queries";

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualificado: "Qualificado",
  proposta_enviada: "Proposta enviada",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  ligacao: "Ligação",
  reuniao: "Reunião",
  email: "E-mail",
  whatsapp: "WhatsApp",
  visita: "Visita",
};

/** Aba/seção "Vendas" do contato (5.6, pack CRM): oportunidades e atividades ligadas a ele. */
export function ContactSalesSection({ sales }: { sales: ContactSalesSummary }) {
  if (sales.opportunities.length === 0 && sales.activities.length === 0) {
    return <p className="text-sm text-zinc-400 dark:text-zinc-500">Nada por aqui ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {sales.opportunities.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Oportunidades</h3>
          <ul className="flex flex-col gap-1">
            {sales.opportunities.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/itens/${o.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm hover:bg-black/[.02] dark:border-white/[.08] dark:hover:bg-white/[.03]"
                >
                  <span className="min-w-0 truncate">
                    {o.title} <span className="text-xs text-zinc-400 dark:text-zinc-500">({o.stage ? (STAGE_LABELS[o.stage] ?? o.stage) : "sem etapa"})</span>
                  </span>
                  <span className="shrink-0">{formatBRL(o.valueCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sales.activities.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Atividades</h3>
          <ul className="flex flex-col gap-1">
            {sales.activities.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/itens/${a.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm hover:bg-black/[.02] dark:border-white/[.08] dark:hover:bg-white/[.03]"
                >
                  <span className="min-w-0 truncate">{a.title}</span>
                  <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                    {a.activityType ? (ACTIVITY_TYPE_LABELS[a.activityType] ?? a.activityType) : ""} {a.date ? new Date(a.date).toLocaleDateString("pt-BR") : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
