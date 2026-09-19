"use client";

import { Mic, Pause, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { readMediaDuration } from "@/features/attachments/lib/read-media-duration";
import { uploadAttachment } from "@/features/attachments/lib/upload-file";
import { requestTranscription } from "../actions";
import { computeAudioLevel } from "../lib/audio-level";
import { extensionForMimeType, pickRecordingMimeType } from "../lib/pick-mime-type";
import { clearRecording, findRecoverableRecording, saveChunk } from "../lib/recording-db";

const CHUNK_INTERVAL_MS = 30_000;
/** 32 kbps: 3h de reunião ficam com ~41 MB, dentro do limite de anexo (50 MB — `attachments/lib/limits.ts`). */
const AUDIO_BITS_PER_SECOND = 32_000;

const secondaryButtonClassName =
  "flex items-center gap-1.5 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]";

type Status = "idle" | "recording" | "paused" | "stopping" | "uploading" | "done" | "error";

interface Recoverable {
  recordingId: string;
  mimeType: string;
  chunks: Blob[];
}

/**
 * Gravador de áudio (2.5): `MediaRecorder` com detecção de formato, medidor
 * de nível (`AnalyserNode`), Wake Lock enquanto grava, e proteção contra
 * perda (pedaços de 30s salvos no IndexedDB, recuperáveis se a página
 * fechar no meio). Ao parar: upload (reaproveita `uploadAttachment`, 1.9) e,
 * se houver provedor de transcrição configurado, pede a transcrição.
 */
export function AudioRecorder({
  itemId,
  onFinished,
  onCancel,
}: {
  itemId: string;
  onFinished?: () => void;
  onCancel?: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoverable, setRecoverable] = useState<Recoverable | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chunkIndexRef = useRef(0);
  const recordingIdRef = useRef("");
  const mimeTypeRef = useRef("");
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const levelFrameRef = useRef<number | null>(null);

  useEffect(() => {
    findRecoverableRecording(itemId)
      .then(setRecoverable)
      .catch(() => {});
  }, [itemId]);

  useEffect(() => {
    return () => {
      stopLevelMeter();
      void releaseWakeLock();
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      } catch {
        // já parado
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function stopLevelMeter() {
    if (levelFrameRef.current !== null) cancelAnimationFrame(levelFrameRef.current);
    levelFrameRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
  }

  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch {
      // sem suporte de verdade ou permissão negada — grava sem a trava de tela
    }
  }

  async function releaseWakeLock() {
    try {
      await wakeLockRef.current?.release();
    } catch {
      // já liberado
    }
    wakeLockRef.current = null;
  }

  function startLevelMeter(stream: MediaStream) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    audioContextRef.current = audioContext;

    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      setLevel(computeAudioLevel(data));
      levelFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }

  async function start() {
    setError(null);
    const mimeType = pickRecordingMimeType();
    if (!mimeType) {
      setError("Este navegador não tem um formato de gravação de áudio suportado.");
      setStatus("error");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
      setStatus("error");
      return;
    }

    streamRef.current = stream;
    mimeTypeRef.current = mimeType;
    recordingIdRef.current = crypto.randomUUID();
    chunksRef.current = [];
    chunkIndexRef.current = 0;
    setElapsedSeconds(0);

    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: AUDIO_BITS_PER_SECOND });
    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) return;
      chunksRef.current.push(event.data);
      const index = chunkIndexRef.current++;
      void saveChunk({
        recordingId: recordingIdRef.current,
        index,
        itemId,
        mimeType,
        blob: event.data,
        createdAt: Date.now(),
      });
    };
    recorder.start(CHUNK_INTERVAL_MS);
    recorderRef.current = recorder;

    startLevelMeter(stream);
    void requestWakeLock();
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);

    setStatus("recording");
  }

  function pause() {
    recorderRef.current?.pause();
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus("paused");
  }

  function resume() {
    recorderRef.current?.resume();
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    setStatus("recording");
  }

  function stop() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (timerRef.current) clearInterval(timerRef.current);
    stopLevelMeter();
    void releaseWakeLock();

    recorder.onstop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      void finish(chunksRef.current, mimeTypeRef.current, recordingIdRef.current);
    };
    recorder.stop();
    setStatus("stopping");
  }

  async function finish(chunks: Blob[], mimeType: string, recordingId: string) {
    if (chunks.length === 0) {
      setError("Gravação vazia — nada foi enviado.");
      setStatus("error");
      return;
    }
    setStatus("uploading");
    setProgress(0);

    const blob = new Blob(chunks, { type: mimeType });
    const durationSeconds = await readMediaDuration(blob);
    const file = new File([blob], `gravacao-${Date.now()}.${extensionForMimeType(mimeType)}`, { type: mimeType });

    const uploadResult = await uploadAttachment(itemId, file, setProgress, durationSeconds ?? undefined);
    setProgress(null);
    if (!uploadResult.ok) {
      setError(uploadResult.error);
      setStatus("error");
      return;
    }
    if (!uploadResult.data) {
      setError("Não foi possível enviar a gravação.");
      setStatus("error");
      return;
    }

    await requestTranscription(itemId, uploadResult.data.attachment.id, durationSeconds ?? undefined);
    await clearRecording(recordingId);

    setStatus("done");
    toast.success("Gravação enviada.");
    onFinished?.();
  }

  async function recover() {
    if (!recoverable) return;
    const { recordingId, mimeType, chunks } = recoverable;
    setRecoverable(null);
    await finish(chunks, mimeType, recordingId);
  }

  async function discardRecovery() {
    if (!recoverable) return;
    await clearRecording(recoverable.recordingId);
    setRecoverable(null);
  }

  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");

  return (
    <div className="flex flex-col gap-3">
      {recoverable && status === "idle" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <span>Encontramos uma gravação não enviada.</span>
          <div className="flex gap-3">
            <button type="button" onClick={() => void recover()} className="underline">
              Enviar
            </button>
            <button type="button" onClick={() => void discardRecovery()} className="underline">
              Descartar
            </button>
          </div>
        </div>
      )}

      {(status === "idle" || status === "error") && (
        <button
          type="button"
          onClick={() => void start()}
          className="bg-foreground text-background flex items-center justify-center gap-2 self-start rounded-full px-5 py-2 text-sm font-medium"
        >
          <Mic className="h-4 w-4" />
          Gravar
        </button>
      )}

      {(status === "recording" || status === "paused") && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg text-black dark:text-zinc-50">
              {minutes}:{seconds}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[.08] dark:bg-white/[.12]">
              <div
                className="h-full bg-red-500 transition-[width]"
                style={{ width: `${Math.min(100, Math.round(level * 140))}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Mantenha a tela ligada enquanto grava.</p>
          <div className="flex gap-2">
            {status === "recording" ? (
              <button type="button" onClick={pause} className={secondaryButtonClassName}>
                <Pause className="h-4 w-4" />
                Pausar
              </button>
            ) : (
              <button type="button" onClick={resume} className={secondaryButtonClassName}>
                <Play className="h-4 w-4" />
                Retomar
              </button>
            )}
            <button
              type="button"
              onClick={stop}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-red-700"
            >
              <Square className="h-4 w-4" />
              Parar
            </button>
          </div>
        </div>
      )}

      {status === "stopping" && <p className="text-sm text-zinc-500 dark:text-zinc-400">Finalizando…</p>}

      {status === "uploading" && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Enviando…{progress !== null ? ` ${Math.round(progress * 100)}%` : ""}
        </p>
      )}

      {status === "done" && <p className="text-sm text-emerald-600 dark:text-emerald-400">Gravação enviada.</p>}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {onCancel && (status === "idle" || status === "error") && (
        <button type="button" onClick={onCancel} className="self-start text-xs text-zinc-500 underline dark:text-zinc-400">
          Cancelar
        </button>
      )}
    </div>
  );
}
