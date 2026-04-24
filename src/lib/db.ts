import type { InventoryItem, Purchase, Sale, StockMovement, StoreName } from "../types";

const DB_NAME = "pink-finance-studio";
const DB_VERSION = 2;
const STORES: StoreName[] = ["purchases", "sales", "inventory", "stockMovements"];
const FALLBACK_STORAGE_PREFIX = "pink-finance-studio";

type StoreMap = {
  purchases: Purchase;
  sales: Sale;
  inventory: InventoryItem;
  stockMovements: StockMovement;
};

const isIndexedDbAvailable = () => typeof window !== "undefined" && typeof window.indexedDB !== "undefined";

const getFallbackStorageKey = (storeName: StoreName) => `${FALLBACK_STORAGE_PREFIX}:${storeName}`;

const readFallbackRecords = <T extends StoreName>(storeName: T): StoreMap[T][] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getFallbackStorageKey(storeName));

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StoreMap[T][];
    return [...parsed].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
};

const writeFallbackRecords = <T extends StoreName>(storeName: T, records: StoreMap[T][]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getFallbackStorageKey(storeName), JSON.stringify(records));
};

const shouldUseFallback = (error?: unknown) => {
  if (!isIndexedDbAvailable()) {
    return true;
  }

  return error instanceof DOMException && ["SecurityError", "InvalidStateError", "UnknownError"].includes(error.name);
};

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error("IndexedDB no esta disponible en este entorno."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      for (const storeName of STORES) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: "id" });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No fue posible abrir IndexedDB."));
  });

const withStore = async <T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
) => {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    transaction.onabort = () => {
      reject(transaction.error ?? new Error("La transaccion fue cancelada."));
      database.close();
    };

    transaction.onerror = () => {
      reject(transaction.error ?? new Error("La transaccion fallo."));
      database.close();
    };

    transaction.oncomplete = () => database.close();

    action(store, resolve, reject);
  });
};

export const getAllRecords = <T extends StoreName>(storeName: T) =>
  withStore<StoreMap[T][]>(storeName, "readonly", (store, resolve, reject) => {
    const request = store.getAll();

    request.onsuccess = () =>
      resolve([...(request.result as StoreMap[T][])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    request.onerror = () => reject(request.error ?? new Error("No fue posible leer los registros."));
  }).catch((error) => {
    if (shouldUseFallback(error)) {
      return readFallbackRecords(storeName);
    }

    throw error;
  });

export const addRecord = <T extends StoreName>(storeName: T, payload: StoreMap[T]) =>
  withStore<void>(storeName, "readwrite", (store, resolve, reject) => {
    const request = store.put(payload);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("No fue posible guardar el registro."));
  }).catch((error) => {
    if (shouldUseFallback(error)) {
      const current = readFallbackRecords(storeName).filter((item) => item.id !== payload.id);
      writeFallbackRecords(storeName, [payload, ...current]);
      return;
    }

    throw error;
  });

export const deleteRecord = (storeName: StoreName, id: string) =>
  withStore<void>(storeName, "readwrite", (store, resolve, reject) => {
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("No fue posible eliminar el registro."));
  }).catch((error) => {
    if (shouldUseFallback(error)) {
      const current = readFallbackRecords(storeName).filter((item) => item.id !== id);
      writeFallbackRecords(storeName, current);
      return;
    }

    throw error;
  });

export const clearAllRecords = async () => {
  if (shouldUseFallback()) {
    if (typeof window !== "undefined") {
      for (const storeName of STORES) {
        window.localStorage.removeItem(getFallbackStorageKey(storeName));
      }
    }
    return;
  }

  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORES, "readwrite");

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("No fue posible borrar los datos."));
    };

    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("La limpieza de datos fue cancelada."));
    };

    for (const storeName of STORES) {
      transaction.objectStore(storeName).clear();
    }
  }).catch((error) => {
    if (shouldUseFallback(error) && typeof window !== "undefined") {
      for (const storeName of STORES) {
        window.localStorage.removeItem(getFallbackStorageKey(storeName));
      }
      return;
    }

    throw error;
  });
};
