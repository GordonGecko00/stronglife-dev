import { useSyncExternalStore } from "react";
import type { AppData } from "../types";
import { buildDefaultData, DATA_VERSION } from "./defaults";
import { migrate } from "./migrate";

const STORAGE_KEY = "stronglife.data";
/** Key written by the first version of the app, imported once on upgrade. */
const LEGACY_STORAGE_KEY = "sl5x5.data.v1";

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function load(): AppData {
  const current = read(STORAGE_KEY);
  if (current) return migrate(current);

  const legacy = read(LEGACY_STORAGE_KEY);
  if (legacy) return migrate(legacy);

  return buildDefaultData();
}

let data: AppData = load();
const listeners = new Set<() => void>();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Out of quota or storage blocked (private mode): keep running in memory
    // rather than losing the workout in progress.
  }
  listeners.forEach((listener) => listener());
}

// Write the loaded (possibly migrated) shape straight back, so an upgrade from
// an older format is durable even if the user never edits anything. The legacy
// key is left in place as a safety net; `load` always prefers the current one.
persist();

export function getData(): AppData {
  return data;
}

/**
 * Apply an update and publish it.
 *
 * The mutator runs against a clone so every update yields a fresh top-level
 * reference: `useSyncExternalStore` compares snapshots with `Object.is`, and
 * mutating in place would leave subscribers rendering stale values.
 */
export function update(mutate: (draft: AppData) => AppData | void): void {
  const draft = structuredClone(data);
  const result = mutate(draft);
  data = result ?? draft;
  data.version = DATA_VERSION;
  persist();
}

/** Wholesale replace, used by restore-from-backup. */
export function replaceAll(next: AppData): void {
  data = migrate(next);
  persist();
}

export function resetAll(): void {
  data = buildDefaultData();
  persist();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getData, getData);
}
