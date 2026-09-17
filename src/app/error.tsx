"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Algo deu errado
      </h1>
      <p className="text-zinc-500 dark:text-zinc-400">
        Um erro inesperado aconteceu. Você pode tentar de novo.
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-foreground text-background rounded-full px-5 py-2 transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        Tentar de novo
      </button>
    </div>
  );
}
