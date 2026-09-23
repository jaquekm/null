export interface NdjsonEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * Separa linhas completas de um buffer NDJSON acumulado (6.7, protocolo do
 * `/api/ask`) — a última "linha" pode estar incompleta (o `fetch` entrega em
 * pedaços que não respeitam quebra de linha), então sobra pro próximo pedaço
 * em vez de tentar `JSON.parse` nela.
 */
export function splitNdjsonBuffer(buffer: string): { events: NdjsonEvent[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events = lines.filter((line) => line.trim().length > 0).map((line) => JSON.parse(line) as NdjsonEvent);
  return { events, rest };
}

/** Lê o corpo da resposta de `/api/ask` como uma sequência de eventos, na ordem em que chegam. */
export async function* readNdjsonStream(body: ReadableStream<Uint8Array>): AsyncGenerator<NdjsonEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = splitNdjsonBuffer(buffer);
      buffer = rest;
      for (const event of events) yield event;
    }
  } finally {
    reader.releaseLock();
  }

  if (buffer.trim()) yield JSON.parse(buffer) as NdjsonEvent;
}
