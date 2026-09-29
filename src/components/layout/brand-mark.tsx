/** Marca do JKode: quadrado violeta com "JK" + nome. Sem imagem — escala e segue o tema sozinha. */
export function BrandMark({ showName = true, size = "md" }: { showName?: boolean; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11 rounded-xl text-base" : "h-8 w-8 rounded-lg text-xs";
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-600 font-bold tracking-tight text-white shadow-sm shadow-violet-500/30 ${box}`}
      >
        JK
      </span>
      {showName && (
        <span className={`font-semibold tracking-tight text-black dark:text-zinc-50 ${size === "lg" ? "text-2xl" : "text-base"}`}>
          JK<span className="text-brand-text">ode</span>
        </span>
      )}
    </span>
  );
}
