"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { updateItemContent } from "../../actions";
import { buildEditorExtensions } from "./extensions";
import { ToolbarBubbleMenu } from "./toolbar-bubble-menu";

const SAVE_DEBOUNCE_MS = 800;

type SaveStatus = "saved" | "saving" | "offline" | "conflict";

export function ItemContentEditor({
  itemId,
  spaceId,
  initialContent,
  updatedAt,
  onSaved,
}: {
  itemId: string;
  spaceId: string | null;
  initialContent: JSONContent | null;
  updatedAt: string;
  onSaved: (updatedAt: string) => void;
}) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const updatedAtRef = useRef(updatedAt);
  const pendingRef = useRef<JSONContent | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    updatedAtRef.current = updatedAt;
  }, [updatedAt]);

  const save = useCallback(
    async (content: JSONContent) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        pendingRef.current = content;
        setStatus("offline");
        return;
      }

      setStatus("saving");
      const result = await updateItemContent(itemId, updatedAtRef.current, content);

      if (!result.ok) {
        if (result.fieldErrors?._conflict) {
          setStatus("conflict");
          return;
        }
        // Erro de rede/servidor: mantém para reenviar quando a conexão voltar.
        pendingRef.current = content;
        setStatus("offline");
        return;
      }

      pendingRef.current = null;
      if (result.data) {
        updatedAtRef.current = result.data.updatedAt;
        onSaved(result.data.updatedAt);
      }
      setStatus("saved");
    },
    [itemId, onSaved],
  );

  useEffect(() => {
    function handleOnline() {
      if (pendingRef.current) void save(pendingRef.current);
    }
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [save]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: buildEditorExtensions(spaceId),
    content: initialContent ?? "",
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[12rem]",
      },
    },
    onUpdate({ editor: updatedEditor }) {
      if (timerRef.current) clearTimeout(timerRef.current);
      const json = updatedEditor.getJSON();
      timerRef.current = setTimeout(() => void save(json), SAVE_DEBOUNCE_MS);
    },
  });

  if (!editor) return null;

  const statusLabel: Record<SaveStatus, string> = {
    saved: "Salvo",
    saving: "Salvando…",
    offline: "Sem conexão — salva ao reconectar",
    conflict: "Alterado em outro dispositivo",
  };

  return (
    <div className="flex flex-col gap-1">
      <ToolbarBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
      <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
        <span>{statusLabel[status]}</span>
        {status === "conflict" && (
          <button type="button" onClick={() => window.location.reload()} className="text-amber-600 underline dark:text-amber-400">
            Recarregar
          </button>
        )}
      </div>
    </div>
  );
}
