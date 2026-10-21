"use client";

// Compare tray: up to 3 models from one category. Kept in localStorage because it is a
// per-device convenience; stamps and notes (which must survive) live in the server DB.

import { useCallback, useSyncExternalStore } from "react";

export interface CompareItem {
  id: string;
  category_id: string;
  name: string;
}

export const COMPARE_MAX = 3;
const KEY = "salimmon.compare.v1";
const EMPTY: CompareItem[] = [];
const listeners = new Set<() => void>();
let cache: CompareItem[] | null = null;

function read(): CompareItem[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed.slice(0, COMPARE_MAX) : [];
  } catch {
    cache = [];
  }
  return cache!;
}

function write(items: CompareItem[]) {
  cache = items;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable: keep the in-memory copy */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export type ToggleResult = "added" | "removed" | "full" | "category_mismatch";

export function useCompare() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggle = useCallback((item: CompareItem): ToggleResult => {
    const current = read();
    if (current.some((i) => i.id === item.id)) {
      write(current.filter((i) => i.id !== item.id));
      return "removed";
    }
    if (current.length && current[0].category_id !== item.category_id) return "category_mismatch";
    if (current.length >= COMPARE_MAX) return "full";
    write([...current, item]);
    return "added";
  }, []);

  const replaceWith = useCallback((item: CompareItem) => write([item]), []);
  const remove = useCallback((id: string) => write(read().filter((i) => i.id !== id)), []);
  const clear = useCallback(() => write([]), []);
  const has = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  return { items, toggle, replaceWith, remove, clear, has };
}
