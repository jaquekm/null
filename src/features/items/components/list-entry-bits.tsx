import { splitLinks } from "@/lib/linkify";

/** Texto com os links clicáveis (abrem em outra aba). */
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.href ? (
          <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="break-all text-brand-text underline">
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** "por Ana": quem adicionou o item por um link de edição (a dona não tem etiqueta). */
export function AuthorChip({ name }: { name: string }) {
  return (
    <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-black/[.06] px-2 py-0.5 align-middle text-xs font-normal text-zinc-600 dark:bg-white/[.1] dark:text-zinc-300">
      por {name}
    </span>
  );
}
