"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Code, Highlighter, Italic, Link as LinkIcon, Underline as UnderlineIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ImproveTextMenu } from "./improve-text-menu";

export function ToolbarBubbleMenu({ editor, itemId }: { editor: Editor; itemId: string }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            highlight: e.isActive("highlight"),
            link: e.isActive("link"),
            code: e.isActive("code"),
          }
        : null,
  });

  function setLink() {
    const url = window.prompt("URL");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  }

  if (!active) return null;

  return (
    <BubbleMenu
      editor={editor}
      className="flex gap-1 rounded-lg border border-black/[.08] bg-white p-1 shadow-lg dark:border-white/[.08] dark:bg-zinc-900"
    >
      <ToolbarButton active={active.bold} onClick={() => editor.chain().focus().toggleBold().run()} label="Negrito">
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={active.italic} onClick={() => editor.chain().focus().toggleItalic().run()} label="Itálico">
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        active={active.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        label="Sublinhado"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        active={active.highlight}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        label="Destaque"
      >
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={active.link} onClick={setLink} label="Link">
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={active.code} onClick={() => editor.chain().focus().toggleCode().run()} label="Código">
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <ImproveTextMenu editor={editor} itemId={itemId} />
    </BubbleMenu>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-7 w-7 items-center justify-center rounded ${
        active ? "bg-black/[.1] dark:bg-white/[.15]" : "hover:bg-black/[.06] dark:hover:bg-white/[.08]"
      }`}
    >
      {children}
    </button>
  );
}
