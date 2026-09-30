import type { QueuedCapture } from "./offline-captures";

/**
 * Fila de capturas sem internet (9.9) no IndexedDB do aparelho — mesmo
 * padrão do `recording-db.ts` (2.5). Cada mudança avisa a tela pelo evento
 * `jkode:offline-captures` pra contagem "N capturas esperando internet".
 */
const DB_NAME = "jkode-offline";
const DB_VERSION = 1;
const STORE = "captures";
export const OFFLINE_CAPTURES_EVENT = "jkode:offline-captures";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error as Error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error as Error);
    });
  } finally {
    db.close();
  }
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OFFLINE_CAPTURES_EVENT));
}

export async function addQueuedCapture(input: Omit<QueuedCapture, "id" | "createdAt">): Promise<void> {
  const entry: QueuedCapture = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await run("readwrite", (store) => {
    store.put(entry);
  });
  notify();
}

export async function listQueuedCaptures(): Promise<QueuedCapture[]> {
  return ((await run<QueuedCapture[]>("readonly", (store) => store.getAll() as IDBRequest<QueuedCapture[]>)) ?? []) as QueuedCapture[];
}

export async function removeQueuedCapture(id: string): Promise<void> {
  await run("readwrite", (store) => {
    store.delete(id);
  });
  notify();
}

export async function countQueuedCaptures(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  return (await run<number>("readonly", (store) => store.count())) ?? 0;
}
