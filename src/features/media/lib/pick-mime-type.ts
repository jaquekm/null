const CANDIDATE_MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4"];

/**
 * Formato de gravação suportado pelo navegador (2.5): `audio/webm;codecs=opus`
 * no Chrome/Android, `audio/mp4` no Safari/iOS. `isSupported` é injetável pra
 * testar sem precisar de `MediaRecorder` de verdade; `null` quando nenhum dos
 * dois é suportado.
 */
export function pickRecordingMimeType(
  isSupported: (mimeType: string) => boolean = (type) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
): string | null {
  return CANDIDATE_MIME_TYPES.find(isSupported) ?? null;
}

export function extensionForMimeType(mimeType: string): string {
  return mimeType.startsWith("audio/mp4") ? "m4a" : "webm";
}
