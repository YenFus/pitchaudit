"use client";

import { useEffect, useState } from "react";

const STAGES: { at: number; label: string }[] = [
  { at: 0, label: "Reading the page and its headers" },
  { at: 3, label: "Checking tags, mobile setup and links" },
  { at: 7, label: "Running Lighthouse in Chrome on this computer — the slow part" },
  { at: 22, label: "Writing up the findings" },
];

export function ProgressStages({ url }: { url: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const active = STAGES.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-5 py-16">
      <p className="pa-eyebrow">Auditing</p>
      <p className="mt-1 break-all font-mono text-lg text-ink">{url}</p>

      <ol className="mt-8 space-y-3" aria-live="polite">
        {STAGES.map((stage, i) => (
          <li
            key={stage.label}
            className={`flex items-center gap-3 text-[0.95rem] ${
              i < active ? "text-muted" : i === active ? "text-ink" : "text-faint"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-xs ${
                i < active
                  ? "border-good bg-good text-card"
                  : i === active
                    ? "border-ink"
                    : "border-rule-strong"
              }`}
            >
              {i < active ? "✓" : i === active ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> : null}
            </span>
            {stage.label}
          </li>
        ))}
      </ol>

      <p className="mt-6 font-mono text-xs text-muted">
        {elapsed}s · most audits take 10–30 seconds
      </p>

      {/* The sheet that is about to appear */}
      <div className="pa-sheet mt-10 animate-pulse p-5" aria-hidden="true">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-40 rounded-sm bg-sunken" />
            <div className="h-3 w-56 rounded-sm bg-sunken/70" />
          </div>
          <div className="h-14 w-14 rounded-sm border-2 border-rule-strong" />
        </div>
        <div className="mt-6 space-y-3">
          {[80, 60, 72, 45].map((w) => (
            <div key={w} className="h-2 rounded-sm bg-sunken" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
