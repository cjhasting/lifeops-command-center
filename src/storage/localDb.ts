import type { AppData } from "../types";
import { migrateData } from "../domain/data";
export const DATA_KEY = "lifeops:data:v6";
export const RECOVERY_KEY = "lifeops:pre-migration";

async function legacyIndexedDb(): Promise<unknown> {
  if (typeof indexedDB === "undefined") return null;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("lifeops-command-center", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("snapshots"))
        req.result.createObjectStore("snapshots");
    };
    req.onerror = () =>
      reject(
        new Error(
          "Could not read the existing database. Your data has not been replaced.",
        ),
      );
    req.onblocked = () =>
      reject(new Error("Close other LifeOps tabs, then reload."));
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("snapshots", "readonly");
      const read = tx.objectStore("snapshots").get("app-data");
      read.onsuccess = () => resolve(read.result || null);
      read.onerror = () => reject(read.error);
      tx.oncomplete = () => db.close();
    };
  });
}
export async function loadSnapshot(): Promise<AppData | null> {
  const current = localStorage.getItem(DATA_KEY);
  if (current !== null) return migrateData(JSON.parse(current));
  // The old writer saved localStorage first; it may be newer than IndexedDB.
  const fallback = localStorage.getItem("lifeops:fallback");
  const old: unknown =
    fallback !== null ? JSON.parse(fallback) : await legacyIndexedDb();
  if (old === null) return null;
  const migrated = migrateData(old);
  if (!localStorage.getItem(RECOVERY_KEY))
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(old));
  saveSnapshot(migrated);
  return migrated;
}
// One canonical, synchronous atomic write: failure never advances in-memory data.
export function saveSnapshot(data: AppData): void {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}
export async function clearSnapshot(): Promise<void> {
  localStorage.removeItem(DATA_KEY);
}
export function backupBeforeImport(data: AppData) {
  localStorage.setItem("lifeops:before-import", JSON.stringify(data));
}
