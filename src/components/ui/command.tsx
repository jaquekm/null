"use client";

import { Search } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import type { ComponentProps } from "react";

/**
 * Wrapper fino sobre o `cmdk` (1.16) — sem `cn()`/clsx/tailwind-merge, para
 * seguir a convenção do projeto de template strings simples nos outros
 * componentes hand-rolled (ex.: `CaptureDialog`). Usa o `Dialog` do próprio
 * cmdk (que embrulha `@radix-ui/react-dialog`) em vez de reimplementar o
 * foco/teclado/portal de um diálogo — algo que a paleta de comandos precisa
 * fazer bem, diferente do `CaptureDialog` (que é simples o bastante para ser
 * feito à mão).
 */
export function CommandDialog({
  open,
  onOpenChange,
  label = "Paleta de comandos",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <CommandPrimitive.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={label}
      overlayClassName="fixed inset-0 z-50 bg-black/50"
      contentClassName="fixed top-24 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border border-black/[.08] bg-white shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
      className="flex flex-col"
    >
      {children}
    </CommandPrimitive.Dialog>
  );
}

export function CommandInput(props: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2 border-b border-black/[.08] px-3 dark:border-white/[.08]">
      <Search className="h-4 w-4 shrink-0 text-zinc-400" />
      <CommandPrimitive.Input
        {...props}
        className="h-11 w-full bg-transparent text-sm text-black placeholder:text-zinc-400 focus:outline-none dark:text-zinc-50"
      />
    </div>
  );
}

export function CommandList(props: ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List {...props} className="max-h-80 overflow-y-auto p-2" />;
}

export function CommandEmpty(props: ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty {...props} className="px-2 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400" />;
}

export function CommandGroup(props: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      {...props}
      className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-zinc-400 [&_[cmdk-group-heading]]:uppercase dark:[&_[cmdk-group-heading]]:text-zinc-500"
    />
  );
}

export function CommandItem(props: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      {...props}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-700 data-[selected=true]:bg-black/[.06] data-[selected=true]:text-black dark:text-zinc-200 dark:data-[selected=true]:bg-white/[.1] dark:data-[selected=true]:text-zinc-50"
    />
  );
}

export function CommandSeparator(props: ComponentProps<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator {...props} className="my-1 h-px bg-black/[.08] dark:bg-white/[.08]" />;
}
