import Link from "next/link";
import type { CanvasRef } from "../queries";

/** "Aparece nos canvases" (5.5) — só aparece quando o item está em algum. */
export function CanvasRefsSection({ refs }: { refs: CanvasRef[] }) {
  if (refs.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">Aparece nos canvases</h2>
      <ul className="flex flex-col gap-1">
        {refs.map((ref) => (
          <li key={ref.canvasId}>
            <Link
              href={`/itens/${ref.canvasItemId}`}
              className="block rounded-lg px-2 py-1.5 text-sm text-black transition-colors hover:bg-black/[.04] dark:text-zinc-50 dark:hover:bg-white/[.06]"
            >
              🗺️ {ref.canvasItemTitle}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
