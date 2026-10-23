"use client";

// Hydration-safe localStorage reads via useSyncExternalStore.
// Server snapshot returns the fallback; the client swaps in the stored
// value on hydration without mismatch warnings or setState-in-effect.

import { useSyncExternalStore } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();

/** Call after any write our own code makes to localStorage. */
export function notifyLocalStore(): void {
  listeners.forEach((l) => l());
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  const onStorage = () => notifyLocalStore();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

// Snapshot cache so repeated reads return referentially stable values.
const jsonCache = new Map<string, { raw: string; parsed: unknown }>();

/** Read a JSON value. `fallback` must be a stable (module-level) reference. */
export function useStoredJSON<T>(key: string, fallback: T): T {
  return useSyncExternalStore(
    subscribe,
    () => {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      const cached = jsonCache.get(key);
      if (cached && cached.raw === raw) return cached.parsed as T;
      let parsed: T;
      try {
        parsed = JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
      jsonCache.set(key, { raw, parsed });
      return parsed;
    },
    () => fallback
  );
}

/** false during server render and the first client render, true after
 *  hydration. Lets a page tell "no stored value yet" from "nothing stored". */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function useStoredString(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key),
    () => null
  );
}
