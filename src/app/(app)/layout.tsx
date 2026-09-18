import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { listActiveSpaces } from "@/features/spaces/queries";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";

const ONBOARDING_PATH = "/configuracoes/boas-vindas";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireOwner();
  const email = user.email ?? "";

  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname !== ONBOARDING_PATH) {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("onboarding_completed_at")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!settings?.onboarding_completed_at) {
      redirect(ONBOARDING_PATH);
    }
  }

  const spaces = await listActiveSpaces(supabase);

  return (
    <div className="flex min-h-dvh">
      <Sidebar spaces={spaces} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar email={email} />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
      </div>
      <BottomNav email={email} />
    </div>
  );
}
