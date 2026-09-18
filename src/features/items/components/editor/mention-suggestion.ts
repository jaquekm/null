import { ReactRenderer } from "@tiptap/react";
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import { createItemForMention, searchItemsForMention } from "../../actions";
import { MentionList, type MentionListItem, type MentionListRef } from "./mention-list";
import { positionPopup } from "./position-popup";

type MentionRenderer = ReactRenderer<MentionListRef, { items: MentionListItem[]; onSelect: (item: MentionListItem) => void }>;

/**
 * Menu de menção `[[` do editor (1.7): busca itens via `search_items` e
 * oferece "Criar item '&lt;texto&gt;'" quando não existe.
 */
export function createMentionSuggestion(spaceId: string | null): Partial<SuggestionOptions<MentionListItem>> {
  return {
    char: "[[",
    items: async ({ query }) => {
      const results = await searchItemsForMention(query);
      const items: MentionListItem[] = results.map((r) => ({ id: r.id, title: r.title }));
      if (query.trim() && !results.some((r) => r.title.toLowerCase() === query.trim().toLowerCase())) {
        items.push({ id: `__create__:${query}`, title: query, isCreate: true });
      }
      return items;
    },
    command: ({ editor, range, props }) => {
      if (props.isCreate) {
        void (async () => {
          const result = await createItemForMention(props.title, spaceId);
          if (!result.ok || !result.data) return;
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: "mention", attrs: { id: result.data.id, label: result.data.title } },
              { type: "text", text: " " },
            ])
            .run();
        })();
        return;
      }

      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: "mention", attrs: { id: props.id, label: props.title } },
          { type: "text", text: " " },
        ])
        .run();
    },
    render: () => {
      let component: MentionRenderer | null = null;

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
