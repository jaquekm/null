"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { toggleShareChecklistItem } from "../actions-public";

/**
 * Delega o clique nos `<li data-share-checkbox data-path="...">` do HTML
 * injetado (`renderPublicContentHtml`, `interactiveChecklist: true`) —
 * permissão `check` (3.11). Não hidrata um `<input>` de verdade em cima do
 * HTML estático (evitaria divergência de hidratação); em vez disso, marca
 * a classe `is-checked` na hora (otimista) e desfaz se a action falhar.
 */
export function ChecklistInteractivity({ token, children }: { token: string; children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-share-checkbox]");
    if (!target || !containerRef.current?.contains(target)) return;

    const path = target.dataset.path;
    if (!path) return;

    const wasChecked = target.dataset.checked === "true";
    const nextChecked = !wasChecked;
    target.dataset.checked = String(nextChecked);
    target.classList.toggle("is-checked", nextChecked);

    startTransition(async () => {
      const result = await toggleShareChecklistItem(token, path, nextChecked);
      if (!result.ok) {
        target.dataset.checked = String(wasChecked);
        target.classList.toggle("is-checked", wasChecked);
        toast.error(result.error);
      }
    });
  }

  return (
    <div ref={containerRef} onClick={handleClick}>
      {children}
    </div>
  );
}
