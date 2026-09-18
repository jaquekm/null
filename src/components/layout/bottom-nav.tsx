"use client";

import { Menu as MenuIcon, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCaptureDialog } from "@/features/capture/components/capture-dialog-provider";
import { MOBILE_PRIMARY_ITEMS, NAV_ITEMS, type NavItem } from "@/lib/nav-items";
import { MobileMenu } from "./mobile-menu";

export function BottomNav({ email }: { email: string }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { open: openCapture } = useCaptureDialog();

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-10 flex h-16 items-center justify-around border-t border-black/[.08] bg-white/90 backdrop-blur md:hidden dark:border-white/[.08] dark:bg-black/90">
        {MOBILE_PRIMARY_ITEMS.slice(0, 2).map((item) => (
          <BottomNavLink
            key={item.href}
            item={item}
            active={pathname.startsWith(item.href)}
          />
        ))}

        <button
          type="button"
          onClick={openCapture}
          className="bg-foreground text-background flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          aria-label="Capturar"
        >
          <Plus className="h-6 w-6" />
        </button>

        {MOBILE_PRIMARY_ITEMS.slice(2, 3).map((item) => (
          <BottomNavLink
            key={item.href}
            item={item}
            active={pathname.startsWith(item.href)}
          />
        ))}

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-zinc-500 dark:text-zinc-400"
          aria-label="Abrir menu"
        >
          <MenuIcon className="h-5 w-5" />
          Menu
        </button>
      </nav>

      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={NAV_ITEMS}
        email={email}
      />
    </>
  );
}

function BottomNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs ${
        active
          ? "text-black dark:text-zinc-50"
          : "text-zinc-500 dark:text-zinc-400"
      }`}
    >
      <Icon className="h-5 w-5" />
      {item.label}
    </Link>
  );
}
