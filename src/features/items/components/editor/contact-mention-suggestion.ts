import { ReactRenderer } from "@tiptap/react";
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import { searchContactsForMention } from "@/features/contacts/actions";
import { MentionList, type MentionListItem, type MentionListRef } from "./mention-list";
import { positionPopup } from "./position-popup";

type ContactMentionRenderer = ReactRenderer<
  MentionListRef,
  { items: MentionListItem[]; onSelect: (item: MentionListItem) => void }
>;

/**
 * Menu de menção `@` de contatos (3.3) — separado do menu `[[` de itens
 * (mesmo componente de lista, `MentionList`, já que a UI é idêntica: busca +
 * navegação por teclado). Sem opção de "criar contato" inline — diferente do
 * `[[`, o enunciado não pede isso pra contatos.
 */
export function createContactMentionSuggestion(): Partial<SuggestionOptions<MentionListItem>> {
  return {
    char: "@",
    items: async ({ query }) => {
      const results = await searchContactsForMention(query);
      return results.map((r) => ({ id: r.id, title: r.name }));
    },
    command: ({ editor, range, props }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: "contactMention", attrs: { id: props.id, label: props.title } },
          { type: "text", text: " " },
        ])
        .run();
    },
    render: () => {
      let component: ContactMentionRenderer | null = null;

      return {
        onStart: (props: SuggestionProps<MentionListItem>) => {
          component = new ReactRenderer(MentionList, {
            props: { items: props.items, onSelect: (item: MentionListItem) => props.command(item) },
            editor: props.editor,
          });
          document.body.appendChild(component.element);
          positionPopup(component.element, props.clientRect);
        },
        onUpdate: (props: SuggestionProps<MentionListItem>) => {
          component?.updateProps({ items: props.items, onSelect: (item: MentionListItem) => props.command(item) });
          if (component) positionPopup(component.element, props.clientRect);
        },
        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === "Escape") {
            component?.element.remove();
            return true;
          }
          return component?.ref?.onKeyDown({ event: props.event }) ?? false;
        },
        onExit: () => {
          component?.element.remove();
          component?.destroy();
          component = null;
        },
      };
    },
  };
}
