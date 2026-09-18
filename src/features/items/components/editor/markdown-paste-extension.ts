import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { markdownToHtml } from "../../lib/markdown-to-html";

/** Linha que parece Markdown dos atalhos suportados: #, -, [], >. */
const MARKDOWN_LINE_PATTERN = /(^|\n)(#{1,3}\s|[-*]\s|>\s)/;

/**
 * "Colar Markdown convertendo em blocos" (1.7): se o texto colado não vier
 * como HTML (ou seja, veio de um editor de texto puro) e parecer Markdown,
 * converte com `markdownToHtml` antes de inserir.
 */
export const MarkdownPaste = Extension.create({
  name: "markdownPaste",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const html = event.clipboardData?.getData("text/html");
            const text = event.clipboardData?.getData("text/plain");
            if (html || !text || !MARKDOWN_LINE_PATTERN.test(text)) return false;

            event.preventDefault();
            editor.commands.insertContent(markdownToHtml(text));
            return true;
          },
        },
      }),
    ];
  },
});
