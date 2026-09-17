export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
        {title}
      </h1>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        {description ?? "Em breve."}
      </p>
    </div>
  );
}
