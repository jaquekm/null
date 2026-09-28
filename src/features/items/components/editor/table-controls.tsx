"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";

const buttonClassName =
  "rounded-md border border-black/[.08] px-2 py-1 text-xs text-zinc-600 hover:bg-black/[.04] disabled:opacity-40 dark:border-white/[.1] dark:text-zinc-300 dark:hover:bg-white/[.06]";

/**
 * Barra de tabela: aparece com o cursor dentro de uma tabela. Antes só dava
 * pra criar tabela pelo menu `/` — não havia como acrescentar ou tirar
 * linha/coluna, então uma tabela importada do Word ficava congelada.
 */
export function TableControls({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e && e.isActive("table")
        ? {
            canDeleteRow: e.can().deleteRow(),
            canDeleteColumn: e.can().deleteColumn(),
          }
        : null,
  });

  if (!state) return null;

  const run = (command: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => command(editor.chain().focus()).run();

  return (
    <div role="toolbar" aria-label="Tabela" className="sticky top-0 z-10 flex flex-wrap gap-1.5 bg-[var(--background)] py-1.5">
      <button type="button" className={buttonClassName} onClick={() => run((c) => c.addRowAfter())}>
        + Linha
      </button>
      <button type="button" className={buttonClassName} onClick={() => run((c) => c.addColumnAfter())}>
        + Coluna
      </button>
      <button type="button" className={buttonClassName} disabled={!state.canDeleteRow} onClick={() => run((c) => c.deleteRow())}>
        − Linha
      </button>
      <button type="button" className={buttonClassName} disabled={!state.canDeleteColumn} onClick={() => run((c) => c.deleteColumn())}>
        − Coluna
      </button>
      <button type="button" className={buttonClassName} onClick={() => run((c) => c.toggleHeaderRow())}>
        Cabeçalho
      </button>
      <button
        type="button"
        className={`${buttonClassName} text-red-600 dark:text-red-400`}
        onClick={() => {
          if (window.confirm("Excluir a tabela inteira?")) run((c) => c.deleteTable());
        }}
      >
        Excluir tabela
      </button>
    </div>
  );
}
