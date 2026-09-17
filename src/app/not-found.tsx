import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Página não encontrada
      </h1>
      <p className="text-zinc-500 dark:text-zinc-400">
        O endereço que você tentou acessar não existe.
      </p>
      <Link
        href="/"
        className="bg-foreground text-background rounded-full px-5 py-2 transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        Voltar para o início
      </Link>
    </div>
  );
}
