"use client";

import Link from "next/link";
import { useState } from "react";
import { EmailSnippet } from "@/components/EmailSnippet";
import { GradeStamp } from "@/components/GradeStamp";
import { IssueCard } from "@/components/IssueList";
import { Logo } from "@/components/Logo";
import { ReportHeader } from "@/components/ReportHeader";
import { buildSnippets } from "@/lib/email-snippets";
import { BRAND_STORAGE_KEY, type Brand } from "@/lib/brand";
import { useStoredJSON } from "@/lib/local-store";
import {
  CATEGORY_LABELS,
  GRADE_COLORS,
  type AuditResult,
  type CategoryId,
} from "@/lib/types";

function domainOf(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
}

async function fetchAudit(url: string): Promise<AuditResult> {
  const res = await fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = (await res.json()) as AuditResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Couldn't audit ${url}`);
  return data;
}

const CATEGORIES: CategoryId[] = [
  "seo",
  "strategy",
  "mobile",
  "performance",
  "accessibility",
  "security",
];

const inputClass =
  "rounded-md border border-rule-strong bg-card px-4 py-3 font-mono text-sm text-ink placeholder:text-faint focus:border-ink focus:outline-none";

export default function ComparePage() {
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  const [a, setA] = useState<AuditResult | null>(null);
  const [b, setB] = useState<AuditResult | null>(null);
  const brand = useStoredJSON<Brand | null>(BRAND_STORAGE_KEY, null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!urlA.trim() || !urlB.trim()) {
      setError("Enter both websites.");
      setPhase("error");
      return;
    }
    setPhase("running");
    setError("");
    try {
      const [ra, rb] = await Promise.all([
        fetchAudit(urlA.trim()),
        fetchAudit(urlB.trim()),
      ]);
      setA(ra);
      setB(rb);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed.");
      setPhase("error");
    }
  }

  const onlyOnA =
    a && b
      ? a.issues.filter((ia) => !b.issues.some((ib) => ib.id === ia.id))
      : [];

  const snippets =
    a && b
      ? (() => {
          const s = buildSnippets({
            domain: domainOf(a.finalUrl),
            topIssues: onlyOnA.length >= 2 ? onlyOnA : a.issues,
            competitor: domainOf(b.finalUrl),
          });
          // Comparison angle first on this page.
          const i = s.findIndex((x) => x.id === "competitor");
          if (i > 0) s.unshift(...s.splice(i, 1));
          return s;
        })()
      : [];

  const bothMeasured = (id: CategoryId) =>
    a?.categories.find((c) => c.id === id)?.measured !== false &&
    b?.categories.find((c) => c.id === id)?.measured !== false;
  const anyProvisional = a?.overall.provisional || b?.overall.provisional;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-20 sm:px-5">
      <div className="pa-noprint flex items-center justify-between py-5">
        <Link href="/" aria-label="Back to the home page">
          <Logo size={20} />
        </Link>
        {phase === "done" && (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border border-rule-strong bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-sunken"
          >
            Download PDF
          </button>
        )}
      </div>

      <h1 className="pa-noprint mt-4 font-serif text-4xl font-semibold text-ink">
        Compare two websites
      </h1>
      <p className="pa-noprint mt-2 max-w-xl text-ink-2">
        Audit a prospect next to a competitor, category by category. It shows
        the problems the prospect has that the competitor doesn&apos;t.
      </p>

      <form
        onSubmit={run}
        className="pa-noprint mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input
          value={urlA}
          onChange={(e) => setUrlA(e.target.value)}
          placeholder="Your prospect — acmeplumbing.com"
          aria-label="Prospect website"
          className={inputClass}
        />
        <input
          value={urlB}
          onChange={(e) => setUrlB(e.target.value)}
          placeholder="Their competitor — rivalplumbing.com"
          aria-label="Competitor website"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={phase === "running"}
          className="pa-btn-accent disabled:opacity-50"
        >
          {phase === "running" ? "Auditing…" : "Compare"}
        </button>
      </form>

      {phase === "error" && (
        <p role="alert" className="mt-4 text-sm text-bad">
          {error}
        </p>
      )}

      {phase === "running" && (
        <p className="mt-16 text-center font-mono text-sm text-muted">
          Running both audits at once. This usually takes 20–40 seconds.
        </p>
      )}

      {phase === "done" && a && b && (
        <article className="pa-sheet mt-8 px-5 py-7 sm:px-9 sm:py-9 print:!border-0 print:!shadow-none">
          <ReportHeader
            brand={brand}
            date={new Date().toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          />

          <div className="grid grid-cols-2 gap-4 py-8">
            {[a, b].map((r, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-3 text-center"
              >
                <p className="pa-eyebrow">
                  {i === 0 ? "Prospect" : "Competitor"}
                </p>
                <p className="font-serif text-xl font-semibold text-ink [overflow-wrap:anywhere]">
                  {domainOf(r.finalUrl)}
                </p>
                <GradeStamp
                  grade={r.overall.grade}
                  score={r.overall.score}
                  size="md"
                  provisional={r.overall.provisional}
                />
              </div>
            ))}
          </div>

          {anyProvisional && (
            <p className="mb-6 rounded-md border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink-2">
              Google&apos;s Lighthouse didn&apos;t respond for at least one of
              these sites, so speed and accessibility aren&apos;t compared
              below.
            </p>
          )}

          <div className="border-t border-ink">
            {CATEGORIES.map((cid) => {
              const ca = a.categories.find((c) => c.id === cid)!;
              const cb = b.categories.find((c) => c.id === cid)!;
              const comparable = bothMeasured(cid);
              const diff = ca.score - cb.score;
              return (
                <div
                  key={cid}
                  className="grid grid-cols-[6.5rem_1fr_6rem_1fr] items-center gap-3 border-b border-rule py-3.5 break-inside-avoid sm:grid-cols-[8rem_1fr_7rem_1fr]"
                >
                  <span className="text-sm font-medium text-ink-2">
                    {CATEGORY_LABELS[cid]}
                  </span>
                  {comparable ? (
                    <>
                      <Bar
                        score={ca.score}
                        color={GRADE_COLORS[ca.grade]}
                        align="right"
                      />
                      <span
                        className={`text-center font-mono text-xs font-semibold ${
                          diff > 0
                            ? "text-good"
                            : diff < 0
                              ? "text-bad"
                              : "text-muted"
                        }`}
                      >
                        {diff > 0
                          ? `${diff} ahead`
                          : diff < 0
                            ? `${Math.abs(diff)} behind`
                            : "level"}
                      </span>
                      <Bar
                        score={cb.score}
                        color={GRADE_COLORS[cb.grade]}
                        align="left"
                      />
                    </>
                  ) : (
                    <span className="col-span-3 text-xs italic text-faint">
                      not compared
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {onlyOnA.length > 0 && (
            <section className="mt-10">
              <h2 className="font-serif text-2xl font-semibold text-ink">
                What {domainOf(a.finalUrl)} has that {domainOf(b.finalUrl)}{" "}
                doesn&apos;t
              </h2>
              <div className="mt-3 border-y border-rule">
                {onlyOnA.slice(0, 8).map((issue, i) => (
                  <IssueCard key={`${issue.id}-${i}`} issue={issue} />
                ))}
              </div>
            </section>
          )}

          {brand?.name && (
            <footer className="mt-10 border-t-2 border-ink pt-4 text-sm text-ink-2">
              Prepared by{" "}
              <span className="font-semibold text-ink">{brand.name}</span>
              {brand.contact ? ` · ${brand.contact}` : ""}
            </footer>
          )}
        </article>
      )}

      {phase === "done" && a && b && (
        <section className="pa-noprint mt-10">
          <h2 className="font-serif text-2xl font-semibold text-ink">
            Send it
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            The first draft puts the two sites next to each other. The others
            only cover the prospect.
          </p>
          <EmailSnippet snippets={snippets} />
        </section>
      )}
    </main>
  );
}

function Bar({
  score,
  color,
  align,
}: {
  score: number;
  color: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      <span
        className="w-7 shrink-0 text-center font-mono text-sm font-semibold"
        style={{ color }}
      >
        {score}
      </span>
      <div
        className={`flex h-2 flex-1 overflow-hidden rounded-sm bg-sunken ${
          align === "right" ? "justify-end" : ""
        }`}
      >
        <div
          className="h-full rounded-sm"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
