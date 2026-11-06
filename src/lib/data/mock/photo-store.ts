// MOCK: photos stored in the browser's IndexedDB. Production replaces this with cloud object storage.
// Images are stored as ArrayBuffers (not Blobs) because some mobile browsers handle Blobs in IndexedDB poorly.
// Display URLs are object URLs (blob:…), created once per photo and released when it is deleted or on reset.

import type { PhotoDimensions } from "@/lib/data/repositories";
import type { ID, PhotoMeta } from "@/lib/types";
import { newId, nowIso } from "./utils";

const DB_NAME = "vah-demo-photos-v1";
const STORE = "photos";

interface PhotoRecord extends PhotoMeta {
  data: ArrayBuffer;
}

let dbPromise: Promise<IDBDatabase> | null = null;
/** Object URLs handed out so far, so each photo gets one URL and it can be released later. */
const objectUrls = new Map<ID, string>();

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDb();
  return new Promise((resolve, reject) => {
    const request = operation(database.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getRecord(id: ID): Promise<PhotoRecord | null> {
  return ((await run("readonly", (store) => store.get(id))) as PhotoRecord | undefined) ?? null;
}

function releaseUrl(id: ID): void {
  const url = objectUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(id);
}

export async function savePhoto(blob: Blob, dimensions?: PhotoDimensions): Promise<PhotoMeta> {
  const meta: PhotoMeta = {
    id: newId(),
    mimeType: blob.type || "image/jpeg",
    size: blob.size,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    createdAt: nowIso(),
  };
  const record: PhotoRecord = { ...meta, data: await blob.arrayBuffer() };
  await run("readwrite", (store) => store.put(record));
  return meta;
}

export async function getPhotoBlob(id: ID): Promise<Blob | null> {
  const record = await getRecord(id);
  return record ? new Blob([record.data], { type: record.mimeType }) : null;
}

export async function getPhotoMeta(id: ID): Promise<PhotoMeta | null> {
  const record = await getRecord(id);
  if (!record) return null;
  return {
    id: record.id,
    mimeType: record.mimeType,
    size: record.size,
    width: record.width ?? null, // photos stored before width/height were recorded
    height: record.height ?? null,
    createdAt: record.createdAt,
  };
}

export async function getPhotoUrl(id: ID): Promise<string | null> {
  const cached = objectUrls.get(id);
  if (cached) return cached;
  const blob = await getPhotoBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  objectUrls.set(id, url);
  return url;
}

export async function removePhoto(id: ID): Promise<void> {
  releaseUrl(id);
  await run("readwrite", (store) => store.delete(id));
}

export async function clearPhotos(): Promise<void> {
  for (const id of [...objectUrls.keys()]) releaseUrl(id);
  if (typeof indexedDB === "undefined") return;
  await run("readwrite", (store) => store.clear());
}
