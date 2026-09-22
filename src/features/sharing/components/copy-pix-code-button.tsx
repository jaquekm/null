"use client";

import { useState } from "react";
import { toast } from "sonner";

/** "Copiar código Pix" (4.10) — copia o BR Code (copia e cola) inteiro pra área de transferência. */
export function CopyPixCodeButton({ payload }: { payload: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(payload);
        setCopied(true);
        toast.success("Código Pix copiado.");
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]"
    >
      {copied ? "Copiado!" : "Copiar código Pix"}
    </button>
  );
}
