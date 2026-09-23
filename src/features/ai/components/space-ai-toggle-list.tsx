"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setSpaceAiEnabled } from "@/features/spaces/actions";

export interface SpaceAiRow {
  id: string;
  name: string;
  icon: string | null;
  aiEnabled: boolean;
}

function SpaceRow({ space }: { space: SpaceAiRow }) {
  const [enabled, setEnabled] = useState(space.aiEnabled);
  const [pending, startTransition] = useTransition();

  function handleChange(checked: boolean) {
    setEnabled(checked);
    startTransition(async () => {
      const result = await setSpaceAiEnabled(space.id, checked);
      if (!result.ok) {
        setEnabled(!checked);
        toast.error(result.error);
      }
    });
  }

  return (
    <label className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-zinc-700 dark:text-zinc-300">
        {space.icon} {space.name}
      </span>
      <input type="checkbox" checked={enabled} disabled={pending} onChange={(e) => handleChange(e.target.checked)} aria-label={`Indexar ${space.name}`} />
    </label>
  );
}

/** "Quais espaços são indexados (lista com toggles de ai_enabled)" (6.5, contrato de privacidade). */
export function SpaceAiToggleList({ spaces }: { spaces: SpaceAiRow[] }) {
  if (spaces.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum espaço criado ainda.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-black/[.06] rounded-lg border border-black/[.08] px-3 dark:divide-white/[.06] dark:border-white/[.08]">
      {spaces.map((space) => (
        <SpaceRow key={space.id} space={space} />
      ))}
    </div>
  );
}
