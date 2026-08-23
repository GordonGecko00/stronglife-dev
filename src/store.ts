import { useSyncExternalStore } from "react";
import type { AppData } from "./types";
import { buildDefaultData } from "./data/defaultPlan";

const STORAGE_KEY = "sl5x5.data.v1";

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppData;
  } catch {
    // fall through to defaults on parse/storage errors
  }
  return buildDefaultData();
}

let data: AppData = load();
const listeners = new Set<() => void>();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  listeners.forEach((l) => l());
}

export function getData(): AppData {
  return data;
}

/**
 * Apply an update to the app data and persist + notify subscribers.
 *
 * The mutator runs against a clone rather than the live object so that every
 * update publishes a fresh top-level reference. `useSyncExternalStore` compares
 * snapshots with `Object.is`, so mutating in place would leave subscribers
 * showing stale values (a controlled input would snap back to its old value
 * even though the new one had been saved).
 */
export function update(fn: (draft: AppData) => AppData | void): void {
  const draft = structuredClone(data);
  const result = fn(draft);
  data = result ?? draft;
  persist();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getData, getData);
}
