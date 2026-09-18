import type { Editor, Range } from "@tiptap/core";
import { uploadAttachment } from "@/features/attachments/lib/upload-file";
import { pickFile } from "./pick-file";

export interface SlashCommandItem {
  title: string;
  run: (props: { editor: Editor; range: Range }) => void;
}

/** Comandos do menu `/` (1.7/1.9): "Imagem" e "Anexo" enviam de verdade agora. */
export function buildSlashCommands(itemId: string): SlashCommandItem[] {
  return [
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
        void (async () => {
          const file = await pickFile("image/*");
          if (!file) return;
          const result = await uploadAttachment(itemId, file);
          if (!result.ok || !result.data) return;
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setImage({ src: `/api/attachments/${result.data.attachment.id}/file`, alt: file.name })
            .run();
        })();
      },
    },
    {
      title: "Anexo",
      run: ({ editor, range }) => {
        void (async () => {
          const file = await pickFile();
          if (!file) return;
          const result = await uploadAttachment(itemId, file);
          if (!result.ok || !result.data) return;
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: `📎 ${file.name}`,
                  marks: [{ type: "link", attrs: { href: `/api/attachments/${result.data.attachment.id}/file?download=1` } }],
                },
              ],
            })
            .run();
        })();
      },
    },
    {
      title: "Link para item",
      run: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent("[[").run(),
    },
  ];
}
