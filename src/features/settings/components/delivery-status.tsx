import { CheckCircle2, CircleAlert } from "lucide-react";
import Link from "next/link";
import type { DeliveryCheck } from "../lib/delivery-checklist";

/**
 * "Por que meus avisos não chegam?" — lista completa em Notificações; nas
 * outras telas (`compact`), só aparece quando falta algo, com link pra lá.
 */
export function DeliveryStatus({ checks, compact = false }: { checks: DeliveryCheck[]; compact?: boolean }) {
  const missing = checks.filter((c) => !c.ok);
  if (compact) {
    if (missing.length === 0) return null;
    return (
      <Link
        href="/configuracoes/notificacoes"
        className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 hover:bg-amber-500/15 dark:text-amber-200"
      >
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          <strong>Seus avisos podem não estar chegando:</strong> {missing.map((c) => c.title.split(" — ")[0]!.toLowerCase()).join("; ")}. Toque pra ver como resolver.
        </span>
      </Link>
    );
  }

  return (
    <section aria-labelledby="delivery-status-title" className="flex flex-col gap-3 rounded-2xl border border-black/[.06] bg-surface p-4 shadow-sm dark:border-white/[.06]">
      <h2 id="delivery-status-title" className="font-semibold text-black dark:text-zinc-50">
        {missing.length === 0 ? "Seus avisos estão funcionando" : "Por que meus avisos não chegam?"}
      </h2>
      <ul className="flex flex-col gap-3">
        {checks.map((check) => (
          <li key={check.key} className="flex items-start gap-2 text-sm">
            {check.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Ok" />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Falta resolver" />
            )}
            <span className="flex flex-col gap-0.5">
              <span className={check.ok ? "text-zinc-700 dark:text-zinc-200" : "font-medium text-black dark:text-zinc-50"}>{check.title}</span>
              {check.fix && <span className="text-zinc-600 dark:text-zinc-300">{check.fix}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
