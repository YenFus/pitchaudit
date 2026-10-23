// Client-side audit history (localStorage, last 20, deduped by URL).

import { notifyLocalStore } from "./local-store";
import type { Grade } from "./types";

export interface HistoryEntry {
  url: string;
  grade: Grade;
  score: number;
  at: string; // ISO date
}

export const HISTORY_STORAGE_KEY = "pa_history";
const KEY = HISTORY_STORAGE_KEY;
const MAX = 20;

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}

export function addHistory(entry: HistoryEntry): void {
  const list = getHistory().filter((e) => e.url !== entry.url);
  list.unshift(entry);
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  notifyLocalStore();
}
