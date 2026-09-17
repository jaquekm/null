"use client";

import { LogOut, X } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/(app)/actions";
import type { NavItem } from "@/lib/nav-items";
import { ThemeToggle } from "./theme-toggle";

export function MobileMenu({
  open,
  onClose,
  items,
  email,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  email: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-white md:hidden dark:bg-black">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-black/[.08] px-4 dark:border-white/[.08]">
        <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
          {email}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.08]"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-base text-zinc-700 transition-colors hover:bg-black/[.04] dark:text-zinc-200 dark:hover:bg-white/[.06]"
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center justify-between border-t border-black/[.08] p-4 dark:border-white/[.08]">
        <ThemeToggle />
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:text-zinc-200 dark:hover:bg-white/[.06]"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
