"use client";

import { LogOut, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(app)/actions";

export function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[.06] text-zinc-600 transition-colors hover:bg-black/[.1] dark:bg-white/[.08] dark:text-zinc-300 dark:hover:bg-white/[.14]"
        aria-label="Menu do usuário"
        aria-expanded={open}
      >
        <User className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-black/[.08] bg-white p-1 shadow-lg dark:border-white/[.08] dark:bg-zinc-900">
          <p className="truncate px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
            {email}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:text-zinc-200 dark:hover:bg-white/[.06]"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
