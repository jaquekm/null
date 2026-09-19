"use client";

import { Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AudioRecorder } from "./audio-recorder";

/** Botão "Gravar reunião" (2.5, ponto de entrada 2) num item já do tipo Reunião. */
export function RecordMeetingButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [recording, setRecording] = useState(false);

  if (!recording) {
    return (
      <button
        type="button"
        onClick={() => setRecording(true)}
        className="flex items-center gap-1.5 self-start rounded-lg border border-black/[.12] px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]"
      >
        <Mic className="h-4 w-4" />
        Gravar reunião
      </button>
    );
  }

  return (
    <AudioRecorder
      itemId={itemId}
      onFinished={() => router.refresh()}
      onCancel={() => setRecording(false)}
    />
  );
}
