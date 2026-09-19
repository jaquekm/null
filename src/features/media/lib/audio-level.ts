/**
 * Nível de áudio 0..1 (RMS) a partir dos dados de domínio do tempo de um
 * `AnalyserNode` (2.5: "medidor de nível", `AnalyserNode` + `getByteTimeDomainData`).
 * Cada amostra é um byte 0..255 centrado em 128 (silêncio); normaliza pra
 * -1..1 antes de calcular a raiz da média dos quadrados.
 */
export function computeAudioLevel(timeDomainData: Uint8Array): number {
  if (timeDomainData.length === 0) return 0;

  let sumSquares = 0;
  for (const sample of timeDomainData) {
    const normalized = (sample - 128) / 128;
    sumSquares += normalized * normalized;
  }
  return Math.sqrt(sumSquares / timeDomainData.length);
}
