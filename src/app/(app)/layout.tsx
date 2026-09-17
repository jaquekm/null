import type { ReactNode } from "react";
import { requireOwner } from "@/lib/auth";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireOwner();
  const email = user.email ?? "";

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar email={email} />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
      </div>
      <BottomNav email={email} />
    </div>
  );
}
