const DB_NAME = 'ielts_scholar_local_db';
const DB_VERSION = 1;

export const STORE_NAMES = {
  practiceRecords: 'practiceRecords',
  activeStates: 'activeStates',
  legacySessionsArchive: 'legacySessionsArchive',
  meta: 'meta',
} as const;

export interface IndexedDbSchema {
  practiceRecords: {
    key: string;
    value: any;
    indexes: {
      byTimestamp: string;
      byModule: string;
      byStatus: string;
    };
  };
  activeStates: {
    key: 'speaking' | 'writing_task1' | 'writing_task2';
    value: any;
    indexes: {};
  };
  legacySessionsArchive: {
    key: string;
    value: any;
    indexes: {
      byTimestamp: string;
    };
  };
  meta: {
    key: string;
    value: any;
    indexes: {};
  };
}

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

export function getDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAMES.practiceRecords)) {
        const practiceStore = db.createObjectStore(STORE_NAMES.practiceRecords, { keyPath: 'id' });
        practiceStore.createIndex('byTimestamp', 'sortTimestamp', { unique: false });
        practiceStore.createIndex('byModule', 'module', { unique: false });
        practiceStore.createIndex('byStatus', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.activeStates)) {
        db.createObjectStore(STORE_NAMES.activeStates, { keyPath: 'stateKey' });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.legacySessionsArchive)) {
        const legacyStore = db.createObjectStore(STORE_NAMES.legacySessionsArchive, { keyPath: 'archiveKey' });
        legacyStore.createIndex('byTimestamp', 'sortTimestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.meta)) {
        db.createObjectStore(STORE_NAMES.meta, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbOpenPromise = null;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      dbOpenPromise = null;
      reject(new Error(`IndexedDB open failed: ${(event.target as IDBOpenDBRequest).error?.message}`));
    };

    request.onblocked = () => {
      dbOpenPromise = null;
      reject(new Error('IndexedDB open blocked. Close other tabs using this app.'));
    };
  });

  return dbOpenPromise;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  dbOpenPromise = null;
}

function storeTransaction(
  storeName: string,
  mode: IDBTransactionMode,
): IDBObjectStore {
  if (!dbInstance) throw new Error('Database not open');
  const transaction = dbInstance.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

export async function storePut(storeName: string, value: any): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
    const request = store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`IndexedDB put failed in "${storeName}": ${request.error?.message}`));
  });
}

export async function storeGet(storeName: string, key: any): Promise<any | undefined> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, 'readonly').objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`IndexedDB get failed in "${storeName}": ${request.error?.message}`));
  });
}

export async function storeGetAll(storeName: string, indexName?: string, query?: IDBKeyRange): Promise<any[]> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, 'readonly').objectStore(storeName);
    const source = indexName ? store.index(indexName) : store;
    const request = source.getAll(query);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error(`IndexedDB getAll failed in "${storeName}": ${request.error?.message}`));
  });
}

export async function storeDelete(storeName: string, key: any): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`IndexedDB delete failed in "${storeName}": ${request.error?.message}`));
  });
}

export async function storeClear(storeName: string): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`IndexedDB clear failed in "${storeName}": ${request.error?.message}`));
  });
}

export async function storeCount(storeName: string): Promise<number> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const store = db.transaction(storeName, 'readonly').objectStore(storeName);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`IndexedDB count failed in "${storeName}": ${request.error?.message}`));
  });
}

export function deleteDatabase(): Promise<void> {
  closeDatabase();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`IndexedDB delete failed: ${request.error?.message}`));
    request.onblocked = () => reject(new Error('IndexedDB delete blocked. Close other tabs.'));
  });
}
