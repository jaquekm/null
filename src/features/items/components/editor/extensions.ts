import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Typography from "@tiptap/extension-typography";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { createContactMentionSuggestion } from "./contact-mention-suggestion";
import { ImagePaste } from "./image-paste-extension";
import { MarkdownPaste } from "./markdown-paste-extension";
import { createMentionSuggestion } from "./mention-suggestion";
import { SlashCommand } from "./slash-command-extension";

const lowlight = createLowlight(common);

/**
 * Extensões do editor Tiptap (1.7/1.9). `spaceId` contextualiza "Criar item"
 * no menu `[[`; `itemId` é usado para anexar imagens/arquivos enviados pelo
 * menu `/` ou colados direto no editor.
 */
export function buildEditorExtensions(spaceId: string | null, itemId: string) {
  return [
    StarterKit.configure({
      codeBlock: false,
      link: {
        openOnClick: true,
        autolink: true,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      },
    }),
    CodeBlockLowlight.configure({ lowlight }),
    Placeholder.configure({ placeholder: "Digite / para comandos" }),
    // Bloco recolhível (6.8, "Resumir": resumo inserido como bloco recolhível) — `persist: true`
    // grava o estado aberto/fechado no próprio documento, senão reabriria sempre ao recarregar.
    Details.configure({ persist: true }),
    DetailsSummary,
    DetailsContent,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    Image,
    Highlight,
    Typography,
    MarkdownPaste,
    ImagePaste.configure({ itemId }),
    SlashCommand.configure({ itemId }),
    Mention.configure({
      suggestion: createMentionSuggestion(spaceId),
      renderHTML({ node }) {
        const label = (node.attrs.label as string | null) ?? (node.attrs.id as string);
        return [
          "a",
          {
            "data-type": "mention",
            "data-id": node.attrs.id as string,
            href: `/itens/${node.attrs.id as string}`,
            class: "mention",
          },
          `[[${label}]]`,
        ] as const;
      },
      renderText({ node }) {
        const label = (node.attrs.label as string | null) ?? (node.attrs.id as string);
        return `[[${label}]]`;
      },
    }),
    // Menção de contatos (3.3) — nó separado do de itens acima (`kind = 'contactMention'`),
    // trigger `@`, grava em `item_contacts` em vez de `links`.
    Mention.extend({ name: "contactMention" }).configure({
      suggestion: createContactMentionSuggestion(),
      renderHTML({ node }) {
        const label = (node.attrs.label as string | null) ?? (node.attrs.id as string);
        return [
          "a",
          {
            "data-type": "contact-mention",
            "data-id": node.attrs.id as string,
            href: `/contatos/${node.attrs.id as string}`,
            class: "mention",
          },
          `@${label}`,
        ] as const;
      },
      renderText({ node }) {
        const label = (node.attrs.label as string | null) ?? (node.attrs.id as string);
        return `@${label}`;
      },
    }),
  ];
}
