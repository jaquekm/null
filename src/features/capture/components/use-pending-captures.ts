"use client";

import { useEffect, useState } from "react";
import { countQueuedCaptures, OFFLINE_CAPTURES_EVENT } from "../lib/offline-capture-db";

/** Quantas capturas feitas sem internet ainda esperam envio (9.9). */
export function usePendingCaptures(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      countQueuedCaptures()
        .then((value) => {
          if (active) setCount(value);
        })
        .catch(() => {});
    };
    refresh();
    window.addEventListener(OFFLINE_CAPTURES_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(OFFLINE_CAPTURES_EVENT, refresh);
    };
  }, []);
  return count;
}
