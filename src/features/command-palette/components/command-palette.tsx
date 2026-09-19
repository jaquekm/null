"use client";

import { Clock, FileText, Inbox as InboxIcon, Moon, Plus, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useCaptureDialog } from "@/features/capture/components/capture-dialog-provider";
import type { BrowseItemRow } from "@/features/items/queries";
import { searchItems, type SearchResultRow } from "@/features/search/actions";
import type { SidebarSpace } from "@/features/spaces/queries";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/lib/nav-items";
import { getRecentItemsForPalette } from "../actions";

const DEBOUNCE_MS = 250;
const THEME_ORDER = ["light", "dark", "system"] as const;

export function CommandPalette({
  open,
  onOpenChange,
  spaces,
  types,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaces: SidebarSpace[];
  types: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { open: openCapture } = useCaptureDialog();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultRow[] | null>(null);
  const [recent, setRecent] = useState<BrowseItemRow[]>([]);
  const [, startTransition] = useTransition();
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery("");
  }

  useEffect(() => {
    if (!open) return;
    getRecentItemsForPalette().then(setRecent);
  }, [open]);

  const hasQuery = query.trim() !== "";

  useEffect(() => {
    if (!hasQuery) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const data = await searchItems(query);
        setResults(data);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [hasQuery, query]);

  function runAndClose(action: () => void) {
    onOpenChange(false);
    action();
  }

  function cycleTheme() {
    const currentIndex = THEME_ORDER.findIndex((value) => value === theme);
    const nextIndex = (Math.max(currentIndex, 0) + 1) % THEME_ORDER.length;
    setTheme(THEME_ORDER[nextIndex]!);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput value={query} onValueChange={setQuery} placeholder="Buscar itens ou digitar um comando..." />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        {hasQuery && results && results.length > 0 && (
          <CommandGroup heading="Itens" forceMount>
            {results.map((item) => (
              <CommandItem
                key={item.id}
                value={`resultado-${item.id}`}
                forceMount
                onSelect={() => runAndClose(() => router.push(`/itens/${item.id}`))}
              >
                <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                <span className="truncate">{item.title || "(sem título)"}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!hasQuery && recent.length > 0 && (
          <CommandGroup heading="Recentes">
            {recent.map((item) => (
              <CommandItem
                key={item.id}
                value={`recente-${item.title}-${item.id}`}
                onSelect={() => runAndClose(() => router.push(`/itens/${item.id}`))}
              >
                <Clock className="h-4 w-4 shrink-0 text-zinc-400" />
                <span className="truncate">{item.title || "(sem título)"}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Ir para">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                value={`ir-para-${item.label}`}
                onSelect={() => runAndClose(() => router.push(item.href))}
              >
                <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
                {item.label}
              </CommandItem>
            );
          })}
          {spaces.map((space) => (
            <CommandItem
              key={space.id}
              value={`ir-para-espaco-${space.name}`}
              onSelect={() => runAndClose(() => router.push(`/espacos/${space.slug}`))}
            >
              <InboxIcon className="h-4 w-4 shrink-0 text-zinc-400" />
              {space.icon ? `${space.icon} ` : ""}
              {space.name}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações">
          <CommandItem value="nova-captura" onSelect={() => runAndClose(() => openCapture())}>
            <Plus className="h-4 w-4 shrink-0 text-zinc-400" />
            Nova captura
          </CommandItem>
          {types.map((type) => (
            <CommandItem
              key={type.id}
              value={`novo-item-${type.name}`}
              onSelect={() => runAndClose(() => openCapture({ typeId: type.id }))}
            >
              <Plus className="h-4 w-4 shrink-0 text-zinc-400" />
              Novo item: {type.name}
            </CommandItem>
          ))}
          <CommandItem value="alternar-tema" onSelect={() => runAndClose(cycleTheme)}>
            {theme === "dark" ? (
              <Moon className="h-4 w-4 shrink-0 text-zinc-400" />
            ) : (
              <Sun className="h-4 w-4 shrink-0 text-zinc-400" />
            )}
            Alternar tema
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
