"use client";

import { Mic, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SidebarSpace } from "@/features/spaces/queries";
import { createRecordingItem } from "@/features/media/actions";
import { AudioRecorder } from "@/features/media/components/audio-recorder";
import { CaptureForm } from "./capture-form";

/**
 * Envolve `CaptureForm` (texto) com os botões "Gravar nota de voz"/"Gravar
 * reunião" (2.5, pontos de entrada 1 e 2b) — usado tanto no diálogo de
 * captura rápida quanto na versão tela cheia (`/capturar`, atalho do
 * celular). Cria o item na hora (`createRecordingItem`) e troca pro
 * `AudioRecorder` assim que ele existir.
 */
export function CapturePanel({
  spaces,
  types,
  initialText,
  initialTypeId,
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
  const [recording, setRecording] = useState<{ itemId: string } | null>(null);
  const [creating, startCreating] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function startRecording(typeSlug: "nota" | "reuniao") {
    setError(null);
    const label = typeSlug === "reuniao" ? "Reunião" : "Nota de voz";
    const title = `${label} — ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`;

    startCreating(async () => {
      const result = await createRecordingItem(typeSlug, title);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRecording({ itemId: result.data.id });
    });
  }

  function handleFinished() {
    if (!recording) return;
    const itemId = recording.itemId;
    onDone?.();
    router.push(`/itens/${itemId}`);
  }

  if (recording) {
    return <AudioRecorder itemId={recording.itemId} onFinished={handleFinished} onCancel={() => setRecording(null)} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <CaptureForm
        spaces={spaces}
        types={types}
        initialText={initialText}
        initialTypeId={initialTypeId}
        redirectOnSave={redirectOnSave}
        onDone={onDone}
      />

      <div className="flex flex-wrap gap-2 border-t border-black/[.08] pt-3 dark:border-white/[.08]">
        <button
          type="button"
          disabled={creating}
          onClick={() => startRecording("nota")}
          className="flex items-center gap-1.5 rounded-lg border border-black/[.12] px-2.5 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]"
        >
          <Mic className="h-4 w-4" />
          Gravar nota de voz
        </button>
        <button
          type="button"
          disabled={creating}
          onClick={() => startRecording("reuniao")}
          className="flex items-center gap-1.5 rounded-lg border border-black/[.12] px-2.5 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]"
        >
          <Users className="h-4 w-4" />
          Gravar reunião
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
