"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NewSpaceButton } from "@/features/spaces/components/new-space-button";
import { SpaceSidebarList } from "@/features/spaces/components/space-sidebar-list";
import type { SidebarSpace } from "@/features/spaces/queries";
import { NAV_ITEMS } from "@/lib/nav-items";
import { BrandMark } from "./brand-mark";

export function Sidebar({
  spaces,
  inboxCount = 0,
  failedJobsCount = 0,
}: {
  spaces: SidebarSpace[];
  inboxCount?: number;
  failedJobsCount?: number;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-black/[.06] bg-surface/70 backdrop-blur transition-[width] duration-200 md:flex dark:border-white/[.06] ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className={`flex h-14 items-center px-3 ${collapsed ? "flex-col justify-center gap-2 py-2 h-auto" : "justify-between"}`}>
        <Link href="/hoje" aria-label="JKode — início" className="min-w-0">
          <BrandMark showName={!collapsed} />
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.08]"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-brand-soft font-medium text-brand-text"
                  : "text-zinc-600 hover:bg-black/[.04] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[.06] dark:hover:text-zinc-50"
              }`}
            >
              {active && <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-brand" />}
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {item.href === "/inbox" && inboxCount > 0 && (
                <span
                  className={`shrink-0 rounded-full bg-black/[.08] px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-white/[.12] dark:text-zinc-300 ${
                    collapsed ? "absolute top-1 right-1 px-1" : ""
                  }`}
                >
                  {inboxCount}
                </span>
              )}
              {item.href === "/configuracoes" && failedJobsCount > 0 && (
                <span
                  className={`shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300 ${
                    collapsed ? "absolute top-1 right-1 px-1" : ""
                  }`}
                >
                  {failedJobsCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-black/[.08] p-2 dark:border-white/[.08]">
        {!collapsed && (
          <p className="px-2 pt-1 pb-0.5 text-xs font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
            Espaços
          </p>
        )}
        <SpaceSidebarList spaces={spaces} collapsed={collapsed} />
        <NewSpaceButton collapsed={collapsed} />
      </div>
    </aside>
  );
}
