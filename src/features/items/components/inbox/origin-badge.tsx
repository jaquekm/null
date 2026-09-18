import { Bot, Code2, FileText, Globe, Mic, Share2, Upload, Zap, type LucideIcon } from "lucide-react";

const ORIGIN_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  quick: { icon: Zap, label: "Captura rápida" },
  web: { icon: Globe, label: "Web" },
  share: { icon: Share2, label: "Compartilhamento" },
  api: { icon: Code2, label: "API" },
  voice: { icon: Mic, label: "Voz" },
  import: { icon: Upload, label: "Importação" },
  automation: { icon: Bot, label: "Automação" },
};

/** Ícone da origem do item (`items.source`) nas linhas do Inbox (1.13). */
export function OriginBadge({ source }: { source: string | null }) {
  const { icon: Icon, label } = (source && ORIGIN_ICONS[source]) || { icon: FileText, label: "Nota" };

  return (
    <span title={label} aria-label={label} className="text-zinc-400 dark:text-zinc-500">
      <Icon className="h-4 w-4" />
    </span>
  );
}
