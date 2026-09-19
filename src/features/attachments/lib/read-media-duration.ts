/**
 * Lê a duração de um arquivo de áudio/vídeo no navegador (2.5: "criar
 * attachments com duration_seconds lido no navegador"). Usa um elemento
 * `<video>` pros dois tipos — ele decodifica áudio puro normalmente também,
 * sem precisar de dois elementos diferentes por tipo.
 */
export function readMediaDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const element = document.createElement("video");
    element.preload = "metadata";

    function finish(duration: number | null) {
      URL.revokeObjectURL(url);
      resolve(duration);
    }

    element.onloadedmetadata = () => {
      if (element.duration === Infinity) {
        // Bug conhecido do Chrome: um blob webm/mp4 gravado (sem duração no
        // cabeçalho, porque foi montado a partir de pedaços) reporta
        // `Infinity` até o navegador escanear o arquivo inteiro — buscar um
        // tempo além do fim força esse escaneamento, e só então `duration`
        // reflete o valor real.
        element.currentTime = Number.MAX_SAFE_INTEGER;
        element.ontimeupdate = () => {
          element.ontimeupdate = null;
          finish(Number.isFinite(element.duration) ? element.duration : null);
        };
      } else {
        finish(Number.isFinite(element.duration) ? element.duration : null);
      }
    };
    element.onerror = () => finish(null);
    element.src = url;
  });
}
