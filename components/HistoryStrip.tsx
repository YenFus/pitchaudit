"use client";

import Link from "next/link";
import { HISTORY_STORAGE_KEY, type HistoryEntry } from "@/lib/history";
import { useStoredJSON } from "@/lib/local-store";
import { GRADE_COLORS } from "@/lib/types";

const EMPTY_HISTORY: HistoryEntry[] = [];

export function HistoryStrip() {
  const history = useStoredJSON<HistoryEntry[]>(HISTORY_STORAGE_KEY, EMPTY_HISTORY);

  if (history.length === 0) return null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="pa-eyebrow">Recent</span>
      {history.slice(0, 5).map((h) => {
        const domain = h.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
        return (
          <Link
            key={h.url}
            href={`/report?url=${encodeURIComponent(h.url)}`}
            className="inline-flex items-center gap-1.5 rounded-sm border border-rule bg-card px-2 py-1 font-mono text-xs text-ink-2 hover:border-ink"
          >
            <span className="font-semibold" style={{ color: GRADE_COLORS[h.grade] }}>
              {h.grade}
            </span>
            {domain}
          </Link>
        );
      })}
    </div>
  );
}
