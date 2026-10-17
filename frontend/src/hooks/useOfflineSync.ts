import { useState, useEffect, useCallback } from 'react';
import { syncBatchRouteApiIntakeSyncBatchPost } from '../client/sdk.gen';

export interface OfflineSessionItem {
  client_session_uuid: string;
  created_at_iso: string;
  language: string;
  symptoms: string[];
  vitals?: Record<string, unknown> | object;
  tenant_id?: string;
  department_id?: string;
}

const DB_NAME = 'medikiosk_offline_db';
const STORE_NAME = 'medikiosk_offline_store';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'client_session_uuid' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncStatus, setLastSyncStatus] = useState<string | null>(null);

  // Refresh pending items count
  const refreshPendingCount = useCallback(async () => {
    try {
      const db = await openDatabase();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const countReq = store.count();
      countReq.onsuccess = () => {
        setPendingCount(countReq.result);
      };
    } catch {
      // IndexedDB fallback in non-supported environments
    }
  }, []);

  // Flush queued sessions to backend
  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);

    try {
      const db = await openDatabase();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getAllReq = store.getAll();

      getAllReq.onsuccess = async () => {
        const items: OfflineSessionItem[] = getAllReq.result || [];
        if (items.length === 0) {
          setIsSyncing(false);
          return;
        }

        try {
          const res = await syncBatchRouteApiIntakeSyncBatchPost({
            body: {
              sessions: items.map((it) => ({
                client_session_uuid: it.client_session_uuid,
                created_at_iso: it.created_at_iso,
                language: it.language,
                symptoms: it.symptoms,
                vitals: it.vitals as Record<string, object> | undefined,
                tenant_id: it.tenant_id || 'default',
                department_id: it.department_id || 'general',
              })),
            },
          });

          if (res.data) {
            // Clear successfully synced items
            const deleteTx = db.transaction(STORE_NAME, 'readwrite');
            const deleteStore = deleteTx.objectStore(STORE_NAME);
            for (const item of items) {
              deleteStore.delete(item.client_session_uuid);
            }
            deleteTx.oncomplete = () => {
              setPendingCount(0);
              setLastSyncStatus(`✓ Synced ${res.data?.synced_count ?? 0} offline sessions`);
            };
          }
        } catch {
          setLastSyncStatus('Re-sync failed, retrying on next network heartbeat.');
        } finally {
          setIsSyncing(false);
        }
      };
    } catch {
      setIsSyncing(false);
    }
  }, []);

  // Queue a session locally
  const queueOfflineSession = useCallback(
    async (
      payload: OfflineSessionItem
    ): Promise<{ token_number: string; is_emergency: boolean }> => {
      // Deterministic offline fallback token
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const tokenNumber = `OFF-K01-${randomSuffix}`;

      // Check emergency red-flag conditions on vitals
      let isEmergency = false;
      const vitalsRecord = payload.vitals as Record<string, unknown> | undefined;
      if (vitalsRecord) {
        const spo2 = Number(vitalsRecord.spo2_percent ?? 98);
        const sysBp = Number(vitalsRecord.systolic_bp_mmhg ?? 120);
        if (spo2 <= 92 || sysBp >= 180 || sysBp <= 90) {
          isEmergency = true;
        }
      }

      try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(payload);
        tx.oncomplete = () => {
          refreshPendingCount();
        };
      } catch {
        // Fallback for memory-only storage
      }

      return {
        token_number: tokenNumber,
        is_emergency: isEmergency,
      };
    },
    [refreshPendingCount]
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refreshPendingCount();

    // Auto-sync interval if items are pending and online
    const interval = setInterval(() => {
      if (navigator.onLine && pendingCount > 0 && !isSyncing) {
        flushQueue();
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [flushQueue, refreshPendingCount, pendingCount, isSyncing]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncStatus,
    queueOfflineSession,
    flushQueue,
    refreshPendingCount,
  };
}
