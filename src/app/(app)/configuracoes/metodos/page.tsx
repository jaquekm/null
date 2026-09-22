import { PackCard } from "@/features/packs/components/pack-card";
import { checkPackRequirements, listInstalledPacks, listLocalPacks, type LocalPackEntry } from "@/features/packs/queries";
import type { Pack } from "@/features/packs/schemas";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

type ValidPackEntry = LocalPackEntry & { pack: Pack };

export default async function MetodosPage() {
  const { supabase, user } = await requireOwner();
  const [entries, installedRows, spaces] = await Promise.all([listLocalPacks(), listInstalledPacks(supabase, user.id), listActiveSpaces(supabase)]);

  const validEntries = entries.filter((entry): entry is ValidPackEntry => Boolean(entry.pack));
  const invalidEntries = entries.filter((entry) => !entry.pack);

  const missingByKey = new Map<string, string[]>();
  for (const entry of validEntries) {
    missingByKey.set(entry.pack.key, await checkPackRequirements(supabase, user.id, entry.pack.requires));
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Métodos (packs)</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Pacotes prontos de tipos, visões e automações — instale, personalize, atualize ou remova quando quiser.
      </p>

      {validEntries.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nenhum pack disponível ainda em <code>packs/</code>.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {validEntries.map((entry) => (
          <PackCard
            key={entry.file}
            file={entry.file}
            pack={entry.pack}
            spaces={spaces}
            installed={installedRows.filter((row) => row.packKey === entry.pack.key)}
            missingModules={missingByKey.get(entry.pack.key) ?? []}
          />
        ))}
      </div>

      {invalidEntries.length > 0 && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">Packs inválidos em packs/:</p>
          <ul className="list-disc pl-5">
            {invalidEntries.map((entry) => (
              <li key={entry.file}>
                {entry.file}: {entry.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
