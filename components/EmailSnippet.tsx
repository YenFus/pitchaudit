"use client";

import { useState } from "react";
import type { Snippet } from "@/lib/email-snippets";

export function EmailSnippet({ snippets }: { snippets: Snippet[] }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const snippet = snippets[active];

  async function copy() {
    await navigator.clipboard.writeText(`Subject: ${snippet.subject}\n\n${snippet.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="pa-card">
      <div className="flex flex-wrap items-center gap-x-1 border-b border-rule px-2">
        {snippets.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={on}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                on
                  ? "border-accent text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={copy}
          className="ml-auto my-1.5 rounded-md border border-rule-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sunken"
        >
          {copied ? "Copied" : "Copy email"}
        </button>
      </div>
      <div className="px-5 py-5">
        <p className="text-sm">
          <span className="pa-eyebrow mr-2">Subject</span>
          <span className="font-medium text-ink">{snippet.subject}</span>
        </p>
        <pre className="mt-4 whitespace-pre-wrap font-sans text-[0.95rem] leading-relaxed text-ink-2">
          {snippet.body}
        </pre>
      </div>
    </div>
  );
}
