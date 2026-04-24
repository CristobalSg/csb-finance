import type { Subject, Task } from "../types";

const STORAGE_KEY = "academic-task-manager";

export interface PersistedState {
  subjects: Subject[];
  tasks: Task[];
}

export const loadLegacyAppState = (): PersistedState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
};

export const clearLegacyAppState = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage cleanup errors.
  }
};
