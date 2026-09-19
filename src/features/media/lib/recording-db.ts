const DB_NAME = "hub-recordings";
const DB_VERSION = 1;
const STORE = "chunks";

export interface StoredChunk {
  recordingId: string;
  index: number;
  itemId: string;
  mimeType: string;
  blob: Blob;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: ["recordingId", "index"] });
        store.createIndex("byItem", "itemId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error as Error);
  });
}

/** Guarda um pedaço gravado (2.5: "a cada 30 s guardar os pedaços gravados no IndexedDB"). */
export async function saveChunk(chunk: StoredChunk): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(chunk);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as Error);
    });
  } finally {
    db.close();
  }
}

/**
 * Pedaços de uma gravação não terminada deste item, se houver (2.5: "se a
 * página fechar, oferecer recuperar a gravação ao voltar"). Um item só tem
 * uma gravação pendente por vez — o primeiro `recordingId` encontrado é o dele.
 */
export async function findRecoverableRecording(
  itemId: string,
): Promise<{ recordingId: string; mimeType: string; chunks: Blob[] } | null> {
  const db = await openDb();
  let all: StoredChunk[];
  try {
    all = await new Promise<StoredChunk[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).index("byItem").getAll(itemId);
      request.onsuccess = () => resolve(request.result as StoredChunk[]);
      request.onerror = () => reject(request.error as Error);
    });
  } finally {
    db.close();
  }
  if (all.length === 0) return null;

  const recordingId = all[0]!.recordingId;
  const chunks = all
    .filter((c) => c.recordingId === recordingId)
    .sort((a, b) => a.index - b.index)
    .map((c) => c.blob);
  return { recordingId, mimeType: all[0]!.mimeType, chunks };
}

/** Limpa os pedaços de uma gravação depois do upload (ou de descartada). */
export async function clearRecording(recordingId: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const range = IDBKeyRange.bound([recordingId, -Infinity], [recordingId, Number.MAX_SAFE_INTEGER]);
      tx.objectStore(STORE).delete(range);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as Error);
    });
  } finally {
    db.close();
  }
}
