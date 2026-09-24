import { colorBadgeClassName } from "@/lib/color-tokens";

/**
 * Pill colorida de tag (`#nome`), na cor salva em `tags.color`. Usada em toda
 * lista/visão que mostra tags de um item — mantém uma cor por tag consistente
 * em qualquer tela, em vez de cada componente desenhar seu próprio span cinza.
 */
export function TagBadge({
  tag,
  onRemove,
  size = "md",
}: {
  tag: { id: string; name: string; color?: string | null };
  onRemove?: (tagId: string) => void;
  size?: "sm" | "md";
}) {
  const sizeClassName = size === "sm" ? "px-1.5 text-[11px]" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-medium ${sizeClassName} ${colorBadgeClassName(tag.color)}`}
    >
      #{tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(tag.id)}
          aria-label={`Remover tag ${tag.name}`}
          className="opacity-70 hover:opacity-100"
        >
          ×
        </button>
      )}
    </span>
  );
}
