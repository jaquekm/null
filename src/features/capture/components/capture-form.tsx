"use client";

import { Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { uploadAttachment } from "@/features/attachments/lib/upload-file";
import type { SidebarSpace } from "@/features/spaces/queries";
import { capture } from "../actions";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

export function CaptureForm({
  spaces,
  types,
  initialText = "",
  initialTypeId = "",
  redirectOnSave = false,
  onDone,
}: {
  spaces: SidebarSpace[];
  types: { id: string; name: string }[];
  initialText?: string;
  initialTypeId?: string;
  redirectOnSave?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [spaceId, setSpaceId] = useState("");
  const [typeId, setTypeId] = useState(initialTypeId);
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    if (!text.trim() || pending) return;

    startTransition(async () => {
      const result = await capture(text, spaceId || null, typeId || null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (!result.data) return;

      if (file) {
        const uploadResult = await uploadAttachment(result.data.id, file);
        if (!uploadResult.ok) toast.error(`Item capturado, mas o anexo falhou: ${uploadResult.error}`);
      }

      setText("");
      setFile(null);
      onDone?.();

      if (redirectOnSave) {
        router.push(`/itens/${result.data.id}`);
        return;
      }

      const itemId = result.data.id;
      toast.success("Capturado", {
        action: { label: "Abrir", onClick: () => router.push(`/itens/${itemId}`) },
      });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Título na primeira linha, o resto vira corpo. #tag vira tag."
        autoFocus
        rows={6}
        disabled={pending}
        className={`${inputClassName} w-full resize-none`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} aria-label="Espaço" className={inputClassName}>
          <option value="">Inbox (sem espaço)</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.icon ? `${space.icon} ` : ""}
              {space.name}
            </option>
          ))}
        </select>
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)} aria-label="Tipo" className={inputClassName}>
          <option value="">Sem tipo</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-black/[.12] px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]"
        >
          <Paperclip className="h-4 w-4" />
          {file ? file.name : "Anexar"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !text.trim()}
        className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Capturando..." : "Capturar"}
      </button>
    </div>
  );
}
