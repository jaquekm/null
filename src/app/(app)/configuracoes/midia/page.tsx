import { AutoOcrToggle } from "@/features/settings/components/auto-ocr-toggle";
import { isAutoOcrEnabled } from "@/features/settings/queries";
import { requireOwner } from "@/lib/auth";

export default async function MediaSettingsPage() {
  const { supabase, user } = await requireOwner();
  const autoOcrEnabled = await isAutoOcrEnabled(supabase, user.id);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Mídia</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Extração de texto de documentos e imagens (OCR).
        </p>
      </div>
      <AutoOcrToggle initialEnabled={autoOcrEnabled} />
    </div>
  );
}
