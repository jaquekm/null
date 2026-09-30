"use client";

import { BellRing, CloudOff, Mic, Paperclip, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { uploadAttachment } from "@/features/attachments/lib/upload-file";
import { createReminderFromPhrase } from "@/features/reminders/actions";
import { describeReminderPhrase, isReminderRequest, parseReminderPhrase } from "@/features/reminders/lib/parse-reminder-phrase";
import type { SidebarSpace } from "@/features/spaces/queries";
import { useOnline } from "@/lib/use-online";
import { capture } from "../actions";
import { joinDictation } from "../lib/dictation";
import { addQueuedCapture } from "../lib/offline-capture-db";
import { isNetworkError, pendingCapturesLabel } from "../lib/offline-captures";
import { useDictation } from "./use-dictation";
import { usePendingCaptures } from "./use-pending-captures";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

export function CaptureForm({
  spaces,
  types,
  initialText = "",
  initialTypeId = "",
  redirectOnSave = false,
  autoStartDictation = false,
  onDone,
}: {
  spaces: SidebarSpace[];
  types: { id: string; name: string }[];
  initialText?: string;
  initialTypeId?: string;
  redirectOnSave?: boolean;
  /** Atalho "Falar" do app instalado (9.9): já abre ouvindo. */
  autoStartDictation?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [spaceId, setSpaceId] = useState("");
  const [typeId, setTypeId] = useState(initialTypeId);
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const online = useOnline();
  const pendingCount = usePendingCaptures();

  // Ditado (9.9): cada trecho fechado entra no texto; o resto da captura (tags, "me lembra de…") vale igual.
  const handleFinalSpeech = useCallback((spoken: string) => setText((current) => joinDictation(current, spoken)), []);
  const handleSpeechError = useCallback((message: string) => toast.error(message), []);
  const dictation = useDictation({ onFinal: handleFinalSpeech, onError: handleSpeechError });
  const { supported: dictationSupported, start: startDictation } = dictation;
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStartDictation || !dictationSupported || autoStarted.current) return;
    autoStarted.current = true;
    startDictation();
  }, [autoStartDictation, dictationSupported, startDictation]);

  // "me lembra de … amanhã 9h" (9.4) vira lembrete em vez de nota. Prévia no
  // fuso do aparelho; o servidor lê a frase de novo no fuso da dona.
  const reminder = useMemo(() => {
    if (!isReminderRequest(text)) return null;
    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
    const parsed = parseReminderPhrase(text, now, timezone);
    if (!parsed || parsed.isPast) return { parsed: null, description: "" };
    return { parsed, description: describeReminderPhrase(parsed, now, timezone) };
  }, [text]);
  const asReminder = Boolean(reminder?.parsed) && !file;

  /** Sem internet (9.9): guarda no aparelho e envia quando voltar (`OfflineSync`). */
  async function saveOffline() {
    if (file) {
      toast.error("Sem internet: anexo precisa de conexão. Tire o anexo pra guardar só o texto.");
      return;
    }
    try {
      await addQueuedCapture({ text, spaceId: spaceId || null, typeId: typeId || null });
    } catch {
      toast.error("Sem internet e não consegui guardar no aparelho. Copie o texto antes de fechar.");
      return;
    }
    setText("");
    onDone?.();
    toast.success("Sem internet — guardei no aparelho e envio quando a conexão voltar.");
  }

  function handleSubmit() {
    if (!text.trim() || pending) return;
    if (dictation.listening) dictation.stop();

    if (!online) {
      startTransition(saveOffline);
      return;
    }

    if (asReminder) {
      startTransition(async () => {
        let result: Awaited<ReturnType<typeof createReminderFromPhrase>>;
        try {
          result = await createReminderFromPhrase({ phrase: text });
        } catch (error) {
          if (isNetworkError(error)) return saveOffline();
          throw error;
        }
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setText("");
        onDone?.();
        toast.success(`Combinado — te lembro ${result.data.description}.`, {
          action: { label: "Ver lembretes", onClick: () => router.push("/lembretes") },
        });
      });
      return;
    }

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof capture>>;
      try {
        result = await capture(text, spaceId || null, typeId || null);
      } catch (error) {
        if (isNetworkError(error)) return saveOffline();
        throw error;
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (!result.data) return;

      if (file) {
        const uploadResult = await uploadAttachment(result.data.id, file);
        if (!uploadResult.ok) toast.error(`Item capturado, mas o anexo falhou: ${uploadResult.error}`);
      }

      setText("");
      setFile(null);
      onDone?.();

      if (redirectOnSave) {
        router.push(`/itens/${result.data.id}`);
        return;
      }

      const itemId = result.data.id;
      toast.success("Capturado", {
        action: { label: "Abrir", onClick: () => router.push(`/itens/${itemId}`) },
      });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {!online && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
          Sem internet — o que você capturar fica guardado e vai quando a conexão voltar.
        </p>
      )}
      <div className="relative">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Título na primeira linha, o resto vira corpo. #tag vira tag. “Me lembra de… amanhã 9h” vira lembrete."
        autoFocus
        rows={6}
        disabled={pending}
        className={`${inputClassName} w-full resize-none ${dictationSupported ? "pr-14" : ""}`}
      />
      {dictationSupported && (
        <button
          type="button"
          onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
          disabled={pending}
          aria-pressed={dictation.listening}
          aria-label={dictation.listening ? "Parar de ouvir" : "Falar"}
          title={dictation.listening ? "Parar de ouvir" : "Falar — o que você disser vira texto"}
          className={`absolute right-2 bottom-2 flex h-11 w-11 items-center justify-center rounded-full shadow-md transition-colors disabled:opacity-60 ${
            dictation.listening ? "animate-pulse bg-red-600 text-white" : "bg-brand text-brand-fg"
          }`}
        >
          {dictation.listening ? <Square className="h-4 w-4" fill="currentColor" /> : <Mic className="h-5 w-5" />}
        </button>
      )}
      </div>
      {dictation.listening && (
        <p aria-live="polite" className="-mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Ouvindo…{dictation.interim && <span className="italic"> {dictation.interim}</span>}
        </p>
      )}

      {reminder && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-brand-soft px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200">
          <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" aria-hidden />
          {reminder.parsed ? (
            <span>
              Vira lembrete: <strong className="font-semibold text-brand-text">{reminder.description}</strong>
              {reminder.parsed.subject && <> — {reminder.parsed.subject}</>}
              {file && " (com anexo, vai como nota)"}
            </span>
          ) : (
            <span>Não entendi quando (ou já passou) — vai como nota. Tente &ldquo;amanhã 9h&rdquo; ou &ldquo;toda segunda&rdquo;.</span>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} aria-label="Espaço" className={inputClassName}>
          <option value="">Inbox (sem espaço)</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.icon ? `${space.icon} ` : ""}
              {space.name}
            </option>
          ))}
        </select>
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)} aria-label="Tipo" className={inputClassName}>
          <option value="">Sem tipo</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-black/[.12] px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]"
        >
          <Paperclip className="h-4 w-4" />
          {file ? file.name : "Anexar"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !text.trim()}
        className="bg-brand text-brand-fg self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Salvando..." : !online ? "Guardar no aparelho" : asReminder ? "Criar lembrete" : "Capturar"}
      </button>
      {pendingCount > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <CloudOff className="h-3.5 w-3.5" aria-hidden />
          {pendingCapturesLabel(pendingCount)}
        </p>
      )}
    </div>
  );
}
