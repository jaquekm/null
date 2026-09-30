"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { markLinkActivitySeen } from "../actions";

/** "Marcar como visto" do cartão "Nos seus links" (9.7). */
export function MarkLinkActivitySeen() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markLinkActivitySeen();
          if (!result.ok) toast.error(result.error);
          else router.refresh();
        })
      }
      className="self-start text-xs font-medium text-brand-text hover:underline disabled:opacity-60"
    >
      {pending ? "Marcando…" : "Marcar tudo como visto"}
    </button>
  );
}
