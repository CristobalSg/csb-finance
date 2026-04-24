import { deleteDB, openDB } from "idb";

import type { Subject, StoredFileItem, Task } from "../types";
import { clearLegacyAppState, loadLegacyAppState } from "./storage";

const DB_NAME = "task-uni-db";
const DB_VERSION = 1;
const TASK_STORE = "tasks";
const FILE_STORE = "files";
const APP_STATE_KEY = "app-state";

const LEGACY_FILES_DB_NAME = "academic-files-db";
const LEGACY_FILES_STORE = "files";

export interface PersistedState {
  subjects: Subject[];
  tasks: Task[];
}

interface AppStateRecord {
  id: string;
  subjects: Subject[];
  tasks: Task[];
  updatedAt: string;
}

export interface BackupPayload {
  exportedAt: string;
  subjects: Subject[];
  tasks: Task[];
  files: Array<Pick<StoredFileItem, "id" | "subjectId" | "name" | "uploadedAt">>;
}

const openTaskUniDb = () =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(TASK_STORE)) {
        db.createObjectStore(TASK_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(FILE_STORE)) {
        const store = db.createObjectStore(FILE_STORE, { keyPath: "id" });
        store.createIndex("subjectId", "subjectId", { unique: false });
      }
    },
  });

const readLegacyFiles = () =>
  new Promise<StoredFileItem[]>((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve([]);
      return;
    }

    const request = indexedDB.open(LEGACY_FILES_DB_NAME);

    request.onerror = () => resolve([]);
    request.onupgradeneeded = () => resolve([]);
    request.onsuccess = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(LEGACY_FILES_STORE)) {
        db.close();
        resolve([]);
        return;
      }

      const transaction = db.transaction(LEGACY_FILES_STORE, "readonly");
      const store = transaction.objectStore(LEGACY_FILES_STORE);
      const getAllRequest = store.getAll();

      getAllRequest.onerror = () => {
        db.close();
        resolve([]);
      };

      getAllRequest.onsuccess = () => {
        db.close();
        resolve((getAllRequest.result as StoredFileItem[]) ?? []);
      };
    };
  });

export const loadAppStateFromDb = async (): Promise<PersistedState | null> => {
  const db = await openTaskUniDb();
  const record = (await db.get(TASK_STORE, APP_STATE_KEY)) as AppStateRecord | undefined;

  if (!record) {
    return null;
  }

  return {
    subjects: record.subjects,
    tasks: record.tasks,
  };
};

export const saveAppStateToDb = async (state: PersistedState) => {
  const db = await openTaskUniDb();

  await db.put(TASK_STORE, {
    id: APP_STATE_KEY,
    subjects: state.subjects,
    tasks: state.tasks,
    updatedAt: new Date().toISOString(),
  } satisfies AppStateRecord);
};

export const getFilesBySubject = async (subjectId: string) => {
  const db = await openTaskUniDb();
  return db.getAllFromIndex(FILE_STORE, "subjectId", subjectId) as Promise<StoredFileItem[]>;
};

export const addFileRecord = async (fileItem: StoredFileItem) => {
  const db = await openTaskUniDb();
  await db.put(FILE_STORE, fileItem);
};

export const deleteFileRecord = async (id: string) => {
  const db = await openTaskUniDb();
  await db.delete(FILE_STORE, id);
};

export const deleteFilesBySubject = async (subjectId: string) => {
  const db = await openTaskUniDb();
  const transaction = db.transaction(FILE_STORE, "readwrite");
  const index = transaction.store.index("subjectId");
  const keys = await index.getAllKeys(subjectId);

  for (const key of keys) {
    await transaction.store.delete(key);
  }

  await transaction.done;
};

export const exportBackupPayload = async (): Promise<BackupPayload> => {
  const db = await openTaskUniDb();
  const record = (await db.get(TASK_STORE, APP_STATE_KEY)) as AppStateRecord | undefined;
  const files = (await db.getAll(FILE_STORE)) as StoredFileItem[];

  return {
    exportedAt: new Date().toISOString(),
    subjects: record?.subjects ?? [],
    tasks: record?.tasks ?? [],
    files: files.map((file) => ({
      id: file.id,
      subjectId: file.subjectId,
      name: file.name,
      uploadedAt: file.uploadedAt,
    })),
  };
};

export const downloadBackup = async () => {
  const payload = await exportBackupPayload();
  const datePart = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `backup-task-uni-${datePart}.json`;
  anchor.click();

  URL.revokeObjectURL(url);
};

export const migrateLegacyDataIfNeeded = async (fallbackState: PersistedState) => {
  const dbState = await loadAppStateFromDb();

  if (!dbState) {
    const legacyState = loadLegacyAppState();
    await saveAppStateToDb(legacyState ?? fallbackState);
    clearLegacyAppState();
  }

  const db = await openTaskUniDb();
  const currentFiles = await db.count(FILE_STORE);

  if (currentFiles === 0) {
    const legacyFiles = await readLegacyFiles();

    if (legacyFiles.length > 0) {
      const transaction = db.transaction(FILE_STORE, "readwrite");

      for (const file of legacyFiles) {
        await transaction.store.put(file);
      }

      await transaction.done;

      try {
        await deleteDB(LEGACY_FILES_DB_NAME);
      } catch {
        // Ignore cleanup failure for legacy file DB.
      }
    }
  }
};
