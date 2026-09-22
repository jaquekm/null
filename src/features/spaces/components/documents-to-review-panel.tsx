import Link from "next/link";
import type { DocumentToReview } from "../queries";

/** Painel "Documentos a revisar" (5.10) na página do espaço — só aparece quando há algo vencido. */
export function DocumentsToReviewPanel({ documents }: { documents: DocumentToReview[] }) {
  if (documents.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
      <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Documentos a revisar</h2>
      <ul className="flex flex-col gap-1">
        {documents.map((doc) => (
          <li key={doc.id}>
            <Link href={`/itens/${doc.id}`} className="text-sm text-amber-900 underline dark:text-amber-200">
              {doc.title}
            </Link>
            <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">vencido em {doc.revisarEm}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
