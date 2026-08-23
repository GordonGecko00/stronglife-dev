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

/** Apply an update to the app data and persist + notify subscribers. */
export function update(fn: (draft: AppData) => AppData | void): void {
  const result = fn(data);
  data = result ?? data;
  persist();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getData, getData);
}
