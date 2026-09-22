"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { getOrCreateDailyNote } from "../actions";

/** `Ctrl/Cmd+D` (5.8, opcional): abre a nota diária de hoje, de qualquer página do app — cria na primeira vez do dia. */
export function DailyNoteShortcut() {
  const router = useRouter();
  const pending = useRef(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "d") return;
      event.preventDefault();
      if (pending.current) return;
      pending.current = true;
      getOrCreateDailyNote()
        .then((result) => {
          if (result.ok) router.push(`/itens/${result.data.id}`);
        })
        .finally(() => {
          pending.current = false;
        });
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}
