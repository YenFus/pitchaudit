"use client";

import Link from "next/link";
import { useState } from "react";
import { EmailSnippet } from "@/components/EmailSnippet";
import { Logo } from "@/components/Logo";
import { buildSnippets } from "@/lib/email-snippets";
import { config } from "@/lib/config";
import { GRADE_COLORS, type AuditResult } from "@/lib/types";

interface Row {
  url: string;
  status: "pending" | "running" | "done" | "error";
  result?: AuditResult;
  error?: string;
}

function domainOf(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
}

// Quote every cell, and defuse values a spreadsheet would run as a formula.
const csvCell = (v: string | number) => {
  const text = String(v);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export default function ProspectsPage() {
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [inputError, setInputError] = useState("");
  const [order, setOrder] = useState<"weakest" | "entered">("weakest");

  async function auditOne(url: string, index: number) {
    setRows((rs) =>
      rs.map((r, i) => (i === index ? { ...r, status: "running" } : r)),
    );
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as AuditResult & { error?: string };
      setRows((rs) =>
        rs.map((r, i) =>
          i === index
            ? res.ok
              ? { ...r, status: "done", result: data }
              : { ...r, status: "error", error: data.error ?? "Failed" }
            : r,
        ),
      );
    } catch {
      setRows((rs) =>
        rs.map((r, i) =>
          i === index ? { ...r, status: "error", error: "Network error" } : r,
        ),
      );
    }
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setInputError("");
    const urls = [
      ...new Set(
        input
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      ),
    ];
    if (urls.length === 0) {
      setInputError("Paste at least one address, one per line.");
      return;
    }
    if (urls.length > config.limits.bulkMax) {
      setInputError(
        `At most ${config.limits.bulkMax} addresses per run — you pasted ${urls.length}.`,
      );
      return;
    }
    setRows(urls.map((url) => ({ url, status: "pending" })));
    setRunning(true);

    // Two at a time: stays well inside Google's quota and our own rate limits.
    let next = 0;
    async function worker() {
      while (next < urls.length) {
        const index = next++;
        await auditOne(urls[index], index);
      }
    }
    await Promise.all([worker(), worker()]);
    setRunning(false);
  }

  const finished = rows.filter(
    (r) => r.status === "done" || r.status === "error",
  ).length;
  const completed = rows.filter((r) => r.status === "done" && r.result);
  const anyProvisional = completed.some((r) => r.result!.overall.provisional);

  // Weakest first among the finished audits; unfinished rows keep their place below.
  const shown =
    order === "entered"
      ? rows
      : [
          ...rows
            .filter((r) => r.status === "done" && r.result)
            .sort((x, y) => x.result!.overall.score - y.result!.overall.score),
          ...rows.filter(
            (r) => r.status === "pending" || r.status === "running",
          ),
          ...rows.filter((r) => r.status === "error"),
        ];

  function exportCsv() {
    if (completed.length === 0) return;
    const header = [
      "Domain",
      "Final URL",
      "Grade",
      "Score",
      "Provisional",
      "Findings",
      "Top findings",
      "Suggested subject",
    ];
    const lines = completed.map((r) => {
      const res = r.result!;
      const domain = domainOf(r.url);
      const subject =
        buildSnippets({ domain, topIssues: res.issues })[0]?.subject ?? "";
      return [
        domain,
        res.finalUrl,
        res.overall.grade,
        res.overall.score,
        res.overall.provisional ? "yes" : "no",
        res.issues.length,
        res.issues
          .slice(0, 3)
          .map((i) => i.title)
          .join(" | "),
        subject,
      ]
        .map(csvCell)
        .join(",");
    });
    const blob = new Blob(
      [[header.map(csvCell).join(","), ...lines].join("\n")],
      {
        type: "text/csv;charset=utf-8;",
      },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pitchaudit-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-20 sm:px-5">
      <div className="flex items-center justify-between py-5">
        <Link href="/" aria-label="Back to the home page">
          <Logo size={20} />
        </Link>
      </div>

      <h1 className="mt-4 font-serif text-4xl font-semibold text-ink">
        Bulk audit
      </h1>
      <p className="mt-2 max-w-xl text-ink-2">
        Paste a list of sites. You get them back ranked weakest first, with each
        site&apos;s main findings and an email draft for every one.
      </p>

      <form onSubmit={run} className="mt-6">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          aria-label="Websites to audit, one per line"
          placeholder={`acmeplumbing.com\nbrightsmiledental.com\nrossisbakery.com\n… one per line, up to ${config.limits.bulkMax}`}
          className="w-full rounded-md border border-rule-strong bg-card p-4 font-mono text-sm text-ink placeholder:text-faint focus:border-ink focus:outline-none"
        />
        {inputError && (
          <p role="alert" className="mt-2 text-sm text-bad">
            {inputError}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={running}
            className="pa-btn-accent disabled:opacity-50"
          >
            {running ? "Auditing…" : "Run the audits"}
          </button>
          {completed.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-md border border-rule-strong bg-card px-3.5 py-2.5 text-sm font-medium text-ink hover:bg-sunken"
            >
              Export CSV ({completed.length})
            </button>
          )}
          {rows.length > 0 && (
            <div className="flex min-w-[140px] flex-1 items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-sm bg-sunken">
                <div
                  className="h-full rounded-sm bg-accent transition-all"
                  style={{ width: `${(finished / rows.length) * 100}%` }}
                />
              </div>
              <span className="font-mono text-xs text-muted">
                {finished}/{rows.length}
              </span>
            </div>
          )}
        </div>
      </form>

      {rows.length > 0 && (
        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-2">
            <p className="pa-eyebrow !text-ink">Results</p>
            <div className="flex items-center gap-1 text-sm">
              {(
                [
                  ["weakest", "Weakest first"],
                  ["entered", "As entered"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setOrder(id)}
                  aria-pressed={order === id}
                  className={`rounded-sm px-2.5 py-1 font-medium ${
                    order === id
                      ? "bg-ink text-paper"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ul>
            {shown.map((row) => {
              const res = row.result;
              return (
                <li key={row.url} className="border-b border-rule py-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="w-9 shrink-0 text-center">
                      {row.status === "done" && res ? (
                        <span
                          className="font-serif text-2xl font-semibold"
                          style={{ color: GRADE_COLORS[res.overall.grade] }}
                          title={
                            res.overall.provisional
                              ? "Provisional grade"
                              : undefined
                          }
                        >
                          {res.overall.grade}
                          {res.overall.provisional ? "*" : ""}
                        </span>
                      ) : row.status === "error" ? (
                        <span className="text-faint">—</span>
                      ) : (
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            row.status === "running"
                              ? "animate-pulse bg-accent"
                              : "bg-rule-strong"
                          }`}
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium text-ink">
                      {domainOf(row.url)}
                    </span>
                    {row.status === "done" && res && (
                      <>
                        <span className="font-mono text-xs text-muted">
                          {res.overall.score}/100 ·{res.issues.length} findings
                        </span>
                        <Link
                          href={`/report?url=${encodeURIComponent(res.finalUrl)}`}
                          className="text-sm font-medium text-ink underline underline-offset-2 hover:text-accent"
                        >
                          Open report
                        </Link>
                      </>
                    )}
                    {row.status === "error" && (
                      <span className="text-sm text-bad">{row.error}</span>
                    )}
                  </div>
                  {row.status === "done" && res && (
                    <>
                      <p className="mt-1.5 pl-[3.25rem] text-sm text-ink-2">
                        {res.issues
                          .slice(0, 3)
                          .map((i) => i.title)
                          .join(" · ") || "Nothing to flag."}
                      </p>
                      <details className="mt-2 pl-[3.25rem]">
                        <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">
                          Email drafts
                        </summary>
                        <div className="mt-3">
                          <EmailSnippet
                            snippets={buildSnippets({
                              domain: domainOf(row.url),
                              topIssues: res.issues,
                            })}
                          />
                        </div>
                      </details>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {anyProvisional && (
            <p className="mt-4 text-xs text-muted">
              * Provisional: Google&apos;s Lighthouse didn&apos;t respond, so
              speed and accessibility aren&apos;t in the grade.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
