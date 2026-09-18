import type { Editor, Range } from "@tiptap/core";

export interface SlashCommandItem {
  title: string;
  run: (props: { editor: Editor; range: Range }) => void;
}

/**
 * Comandos do menu `/` (1.7). "Anexo" fica de fora — anexos são a tarefa
 * 1.9, ainda sem infraestrutura de upload/armazenamento no editor.
 */
export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    title: "Título 1",
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Título 2",
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Título 3",
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Lista",
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Lista numerada",
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Tarefa",
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Tabela",
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: "Citação",
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Código",
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Divisor",
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: "Imagem",
    run: ({ editor, range }) => {
      const url = window.prompt("URL da imagem");
      if (!url) return;
      editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
    },
  },
  {
    title: "Link para item",
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent("[[").run(),
  },
];
