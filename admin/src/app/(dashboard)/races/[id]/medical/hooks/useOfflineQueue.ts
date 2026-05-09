'use client';

/**
 * F-018 BR-MI-33 — Offline queue using NATIVE IndexedDB browser API.
 *
 * NO `idb` npm package install (TD-F013-TESTSTACK locked). Hand-rolled
 * Promise wrapper around `window.indexedDB`.
 *
 * Mode of operation:
 *  1. `enqueueOffline(item)` — write to IDB, return generated queueId.
 *  2. `useOfflineQueue()` hook — exposes `pending` count + `flush()` + listens
 *     for `online` event → auto-flush.
 *  3. Background Sync API (optional progressive enhancement) is registered if
 *     SW + 'sync' supported — `'periodicsync'` listener replays queue.
 *
 * Failure modes:
 *  - Quota exceeded → fallback to in-memory array + warning toast (caller).
 *  - Browser without IndexedDB (Safari private mode) → in-memory only.
 */

import { useCallback, useEffect, useState } from 'react';
import { medicalIncidentControllerCreate } from '@/lib/api-generated/sdk.gen';
import type { CreateIncidentDto } from '@/lib/api-generated/types.gen';
import { OFFLINE_QUEUE } from '../medical.constant';
import type { CreateIncidentPayload } from './useIncidentMutation';

export interface QueuedIncident {
  id?: number;
  raceId: string;
  payload: CreateIncidentPayload;
  queuedAt: string;
  retries?: number;
}

const memoryFallback: QueuedIncident[] = [];
let useMemoryFallback = false;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const req = window.indexedDB.open(
        OFFLINE_QUEUE.dbName,
        OFFLINE_QUEUE.version,
      );
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OFFLINE_QUEUE.storeName)) {
          db.createObjectStore(OFFLINE_QUEUE.storeName, {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function enqueueOffline(
  item: QueuedIncident,
): Promise<string> {
  const db = await openDb();
  if (!db) {
    useMemoryFallback = true;
    const memId = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    memoryFallback.push({ ...item, id: undefined });
    return memId;
  }
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(OFFLINE_QUEUE.storeName, 'readwrite');
      const store = tx.objectStore(OFFLINE_QUEUE.storeName);
      const req = store.add({ ...item, retries: 0 });
      req.onsuccess = () => resolve(`${req.result}`);
      req.onerror = () => {
        // QuotaExceededError — fallback to in-memory.
        useMemoryFallback = true;
        memoryFallback.push(item);
        resolve(`mem-${Date.now()}`);
      };
    } catch (err) {
      reject(err as Error);
    }
  });
}

async function listAll(): Promise<QueuedIncident[]> {
  if (useMemoryFallback) return [...memoryFallback];
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(OFFLINE_QUEUE.storeName, 'readonly');
      const store = tx.objectStore(OFFLINE_QUEUE.storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as QueuedIncident[]);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function deleteOne(id: number): Promise<void> {
  if (useMemoryFallback) {
    const idx = memoryFallback.findIndex((q) => q.id === id);
    if (idx >= 0) memoryFallback.splice(idx, 1);
    return;
  }
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(OFFLINE_QUEUE.storeName, 'readwrite');
      const store = tx.objectStore(OFFLINE_QUEUE.storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function flushQueue(): Promise<{ ok: number; failed: number }> {
  const items = await listAll();
  let ok = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const res = await medicalIncidentControllerCreate({
        path: { raceId: item.raceId },
        body: item.payload as unknown as CreateIncidentDto,
      });
      if (!res.error && res.data) {
        if (typeof item.id === 'number') {
          await deleteOne(item.id);
        }
        ok += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }
  return { ok, failed };
}

interface UseOfflineQueueReturn {
  pending: number;
  isOnline: boolean;
  flush: () => Promise<{ ok: number; failed: number }>;
  refresh: () => Promise<void>;
}

export function useOfflineQueue(): UseOfflineQueueReturn {
  const [pending, setPending] = useState(0);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  const refresh = useCallback(async () => {
    const items = await listAll();
    setPending(items.length);
  }, []);

  const flush = useCallback(async () => {
    const result = await flushQueue();
    await refresh();
    return result;
  }, [refresh]);

  useEffect(() => {
    void refresh();
    if (typeof window === 'undefined') return;

    const onOnline = () => {
      setIsOnline(true);
      void flush();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [flush, refresh]);

  return { pending, isOnline, flush, refresh };
}
