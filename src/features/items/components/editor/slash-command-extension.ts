import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { positionPopup } from "./position-popup";
import { SlashCommandList, type SlashCommandListRef } from "./slash-command-list";
import { SLASH_COMMANDS, type SlashCommandItem } from "./slash-commands";

type SlashCommandRenderer = ReactRenderer<
  SlashCommandListRef,
  { items: SlashCommandItem[]; onSelect: (item: SlashCommandItem) => void }
>;

/** Menu de barra `/` do editor (1.7), construído com o mesmo utilitário de sugestão do Mention. */
export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        char: "/",
        startOfLine: false,
        items: ({ query }) =>
          SLASH_COMMANDS.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())),
        command: ({ editor, range, props }) => {
          props.run({ editor, range });
        },
        render: () => {
          let component: SlashCommandRenderer | null = null;

          return {
            onStart: (props: SuggestionProps<SlashCommandItem>) => {
              component = new ReactRenderer(SlashCommandList, {
                props: { items: props.items, onSelect: (item: SlashCommandItem) => props.command(item) },
                editor: props.editor,
              });
              document.body.appendChild(component.element);
              positionPopup(component.element, props.clientRect);
            },
            onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
              component?.updateProps({
                items: props.items,
                onSelect: (item: SlashCommandItem) => props.command(item),
              });
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
      }),
    ];
  },
});
