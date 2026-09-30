"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { dictationErrorMessage, getSpeechRecognition, type SpeechRecognitionLike } from "../lib/dictation";

const subscribeNoop = () => () => {};

/**
 * Ditado do navegador (9.9). `onFinal` recebe cada trecho já fechado; o
 * trecho ainda em andamento fica em `interim` (mostrado cinza, sem gravar).
 */
export function useDictation({ onFinal, onError }: { onFinal: (text: string) => void; onError: (message: string) => void }) {
  const supported = useSyncExternalStore(
    subscribeNoop,
    () => getSpeechRecognition(window) !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onFinalRef.current = onFinal;
    onErrorRef.current = onError;
  }, [onFinal, onError]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition(window);
    if (!Ctor || recognitionRef.current) return;
    const recognition = new Ctor();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]!;
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) onFinalRef.current(transcript);
        else pending += transcript;
      }
      setInterim(pending);
    };
    recognition.onerror = (event) => {
      const message = dictationErrorMessage(event.error);
      if (message) onErrorRef.current(message);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      onErrorRef.current("Não consegui ligar o microfone. Toque de novo.");
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { supported, listening, interim, start, stop };
}
