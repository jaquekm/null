"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useMounted } from "@/lib/use-mounted";

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return <div className="h-9 w-9" aria-hidden />;
  }

  const currentIndex = OPTIONS.findIndex((option) => option.value === theme);
  const current = OPTIONS[currentIndex === -1 ? 2 : currentIndex]!;
  const Icon = current.icon;

  function cycleTheme() {
    const nextIndex = (Math.max(currentIndex, 0) + 1) % OPTIONS.length;
    setTheme(OPTIONS[nextIndex]!.value);
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-black/[.04] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[.08] dark:hover:text-zinc-50"
      aria-label={`Tema: ${current.label}. Clique para alternar.`}
      title={`Tema: ${current.label}`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
