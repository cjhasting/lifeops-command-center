import type { AppData } from "../types";

const DB_NAME = "lifeops-command-center";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "app-data";
const FALLBACK_KEY = "lifeops:fallback";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function loadSnapshot(): Promise<AppData | null> {
  if (!idbAvailable()) {
    const raw = localStorage.getItem(FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as AppData) : null;
  }

  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(SNAPSHOT_KEY);
      request.onsuccess = () => resolve((request.result as AppData) || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    const raw = localStorage.getItem(FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as AppData) : null;
  }
}

export async function saveSnapshot(data: AppData): Promise<void> {
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(data));

  if (!idbAvailable()) return;

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(data, SNAPSHOT_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearSnapshot(): Promise<void> {
  localStorage.removeItem(FALLBACK_KEY);
  if (!idbAvailable()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(SNAPSHOT_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
