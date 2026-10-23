"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import { AuditForm } from "@/components/AuditForm";
import { EmailSnippet } from "@/components/EmailSnippet";
import { GradeStamp } from "@/components/GradeStamp";
import { IssueCard, IssueList } from "@/components/IssueList";
import { Logo } from "@/components/Logo";
import { ProgressStages } from "@/components/ProgressStages";
import { ReportHeader } from "@/components/ReportHeader";
import { ScoreTable } from "@/components/ScoreTable";
import { buildSnippets } from "@/lib/email-snippets";
import {
  addHistory,
  HISTORY_STORAGE_KEY,
  type HistoryEntry,
} from "@/lib/history";
import { BRAND_STORAGE_KEY, type Brand } from "@/lib/brand";
import { useStoredJSON } from "@/lib/local-store";
import { config } from "@/lib/config";
import type { AuditResult } from "@/lib/types";

const EMPTY_HISTORY: HistoryEntry[] = [];

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "done"; result: AuditResult };

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ToolButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-rule-strong bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-sunken"
    >
      {children}
    </button>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <ToolButton
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : label}
    </ToolButton>
  );
}

function Vital({
  label,
  value,
  good,
  poor,
}: {
  label: string;
  value: number | undefined;
  good: number;
  poor: number;
}) {
  if (value === undefined) return null;
  const tone = value <= good ? "text-good" : value <= poor ? "text-warn" : "text-bad";
  const shown = label === "CLS" ? value.toFixed(2) : `${(value / 1000).toFixed(1)}s`;
  return (
    <span>
      <span className="text-muted">{label}</span>{" "}
      <span className={`font-semibold ${tone}`}>{shown}</span>
    </span>
  );
}

export function ReportClient() {
  const params = useSearchParams();
  const rawUrl = params.get("url") ?? "";
  const [state, setState] = useState<State>({ phase: "loading" });
  const brand = useStoredJSON<Brand | null>(BRAND_STORAGE_KEY, null);
  const history = useStoredJSON<HistoryEntry[]>(HISTORY_STORAGE_KEY, EMPTY_HISTORY);

  // All state updates happen after the fetch await — the component mounts
  // in the loading phase (and is remounted per URL by the page key).
  const run = useCallback(async () => {
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: rawUrl,
        }),
      });
      const data = (await res.json()) as AuditResult & { error?: string };
      if (!res.ok) {
        setState({
          phase: "error",
          message: data.error ?? "Something went wrong. Please try again.",
        });
        return;
      }
      setState({ phase: "done", result: data });
      addHistory({
        url: data.finalUrl,
        grade: data.overall.grade,
        score: data.overall.score,
        at: new Date().toISOString(),
      });
      document.title = `${domainOf(data.finalUrl)}: ${
        data.overall.provisional ? "provisional " : ""
      }grade ${data.overall.grade} · ${config.appName}`;
    } catch {
      setState({
        phase: "error",
        message: "Network problem — check your connection and try again.",
      });
    }
  }, [rawUrl]);

  useEffect(() => {
    // False positive: run() only sets state in async continuations after
    // awaited fetch responses — never synchronously within the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (rawUrl) void run();
  }, [rawUrl, run]);

  if (!rawUrl) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-6 px-5">
        <Logo size={26} />
        <p className="font-serif text-2xl text-ink">Which website should we audit?</p>
        <AuditForm large autoFocus />
      </main>
    );
  }

  if (state.phase === "loading") {
    return (
      <main className="min-h-screen">
        <ProgressStages url={rawUrl} />
      </main>
    );
  }

  if (state.phase === "error") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-5 px-5">
        <Logo size={24} />
        <h1 className="font-serif text-3xl font-semibold text-ink">
          We couldn&apos;t audit that site
        </h1>
        <p className="text-ink-2">{state.message}</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setState({ phase: "loading" });
              void run();
            }}
            className="pa-btn-ink"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-md border border-rule-strong px-4 py-2.5 text-[0.9375rem] font-semibold text-ink hover:bg-sunken"
          >
            Audit a different site
          </Link>
        </div>
      </main>
    );
  }

  const { result } = state;
  const provisional = result.overall.provisional === true;
  const activeBrand: Brand | null = brand?.name ? brand : null;
  const domain = domainOf(result.finalUrl);
  const criticals = result.issues.filter((i) => i.severity === "critical");
  const rest = result.issues.filter((i) => i.severity !== "critical");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const encodedUrl = encodeURIComponent(result.finalUrl);
  const reportUrl = `${origin}/report?url=${encodedUrl}`;
  const badgeSnippet = `<a href="${reportUrl}"><img src="${origin}/api/badge?url=${encodedUrl}" alt="Website grade by ${config.appName}" /></a>`;
  const auditedOn = new Date(result.fetchedAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const snippets = buildSnippets({ domain, topIssues: result.issues });

  const accentStyle =
    activeBrand?.color && /^#[0-9a-fA-F]{3,8}$/.test(activeBrand.color)
      ? ({ "--accent": activeBrand.color } as CSSProperties)
      : undefined;

  const summary = [
    `Website audit: ${domain}${
      provisional ? "" : ` — grade ${result.overall.grade} (${result.overall.score}/100)`
    }`,
    "",
    ...result.issues
      .slice(0, 3)
      .map((i) => `• ${i.pitch ?? `${i.title}: ${i.finding}.`}`),
    "",
    `Full report: ${reportUrl}`,
  ].join("\n");

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-20 sm:px-5" style={accentStyle}>
      {/* Toolbar */}
      <div className="pa-noprint flex flex-wrap items-center justify-between gap-3 py-5">
        <Link href="/" aria-label="Back to the home page">
          <Logo size={20} />
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={summary} label="Copy summary" />
          <CopyButton text={reportUrl} label="Copy link" />
          <ToolButton onClick={() => window.print()}>Download PDF</ToolButton>
          <Link href="/" className="pa-btn-ink !px-3.5 !py-1.5 !text-sm">
            New audit
          </Link>
        </div>
      </div>

      {/* The document */}
      <article className="pa-sheet px-5 py-7 sm:px-9 sm:py-9 print:!border-0 print:!shadow-none">
        <ReportHeader brand={activeBrand} date={auditedOn} />

        <section className="grid gap-6 py-8 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0">
            <p className="pa-eyebrow">Audit of</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight text-ink [overflow-wrap:anywhere] sm:text-4xl">
              {/* Break before a dot, never mid-word. */}
              {domain.split(/(?=\.)/).map((part, i) => (
                <span key={i}>
                  {i > 0 && <wbr />}
                  {part}
                </span>
              ))}
            </h1>
            {result.pageMeta.title && (
              <p className="mt-1 text-ink-2">{result.pageMeta.title}</p>
            )}
            <p className="mt-1 font-mono text-xs text-muted [overflow-wrap:anywhere]">
              {result.finalUrl}
            </p>
            <p className="mt-5 max-w-lg font-serif text-xl leading-snug text-ink">
              {result.overall.verdict}
            </p>
          </div>
          <div className="justify-self-start sm:justify-self-end">
            <GradeStamp
              grade={result.overall.grade}
              score={result.overall.score}
              provisional={provisional}
              tilt
            />
          </div>
        </section>

        {provisional && (
          <div className="mb-8 rounded-md border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink">
            <p className="font-semibold text-warn">This grade is provisional.</p>
            <p className="mt-0.5 text-ink-2">
              Google&apos;s Lighthouse didn&apos;t respond for this site, so speed and
              accessibility couldn&apos;t be measured and are left out of the grade. The
              findings below come from our own checks of the page. Run it again in a
              minute for the full measurement.
            </p>
          </div>
        )}

        <ScoreTable categories={result.categories} />

        {result.vitals &&
          (result.vitals.lcpMs !== undefined ||
            result.vitals.cls !== undefined ||
            result.vitals.inpMs !== undefined) && (
            <p className="mt-4 font-mono text-xs text-ink-2">
              <span className="pa-eyebrow mr-3">Core Web Vitals · mobile</span>
              <span className="inline-flex flex-wrap gap-x-4">
                <Vital label="LCP" value={result.vitals.lcpMs} good={2500} poor={4000} />
                <Vital label="CLS" value={result.vitals.cls} good={0.1} poor={0.25} />
                <Vital label="INP" value={result.vitals.inpMs} good={200} poor={500} />
              </span>
            </p>
          )}

        {/* Findings */}
        <div className="mt-12 space-y-10">
          {criticals.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl font-semibold text-ink">
                Fix these first
              </h2>
              <p className="mt-1 mb-2 text-sm text-muted">
                The findings marked Critical.
              </p>
              <div className="border-y border-rule">
                {criticals.map((issue, i) => (
                  <IssueCard key={`${issue.id}-${i}`} issue={issue} open />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-4 font-serif text-2xl font-semibold text-ink">
              {criticals.length > 0 ? "Other findings" : "Findings"}
            </h2>
            <IssueList
              issues={rest}
              openFirst={criticals.length === 0}
            />
            {rest.length === 0 && criticals.length === 0 && (
              <p className="text-ink-2">
                Nothing to flag. This site is in solid shape on everything we check.
              </p>
            )}
          </section>
        </div>

        {/* Printed footer */}
        <footer className="mt-12 border-t-2 border-ink pt-4 text-sm text-ink-2">
          {activeBrand?.name ? (
            <p>
              Prepared by <span className="font-semibold text-ink">{activeBrand.name}</span>
              {activeBrand.contact ? ` · ${activeBrand.contact}` : ""}
            </p>
          ) : (
            <p>
              Made with{" "}
              <a href={origin || "/"} className="font-semibold text-ink underline underline-offset-2">
                {config.appName}
              </a>
              .
            </p>
          )}
          <p className="mt-1 text-xs text-muted">
            Automated audit of the public page{provisional ? ", without Google Lighthouse" : ""}.
            Findings show the evidence we saw; check anything you plan to quote.
          </p>
        </footer>
      </article>

      {/* After the document: everything here is for the freelancer, not the client */}
      <div className="mt-10 space-y-10">
        <section className="pa-noprint">
          <h2 className="font-serif text-2xl font-semibold text-ink">Send it</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Emails written from what we found on this site. Edit the placeholders and send.
          </p>
          <EmailSnippet snippets={snippets} />
        </section>

        {!activeBrand && (
          <section className="pa-card pa-noprint flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="pa-eyebrow">Your name on it</p>
              <p className="mt-1 text-ink-2">
                Add your name, logo, colours and contact line, and every report and PDF carries
                them instead of ours. It&apos;s saved in this browser only.
              </p>
            </div>
            <Link href="/branding" className="pa-btn-ink">
              Set up branding
            </Link>
          </section>
        )}

        {/* A provisional grade isn't fit to publish, so no badge until Lighthouse has run. */}
        <section className={`pa-noprint ${provisional ? "hidden" : ""}`}>
          <h2 className="font-serif text-xl font-semibold text-ink">Grade badge</h2>
          <p className="mt-1 mb-3 text-sm text-muted">
            Embed this site&apos;s live grade anywhere. It re-checks when the page is loaded.
          </p>
          <div className="pa-card flex flex-col gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/badge?url=${encodedUrl}`}
              alt={`${config.appName} grade badge for ${domain}`}
              className="h-7 self-start"
            />
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-sm bg-sunken px-3 py-2 font-mono text-xs text-ink-2">
                {badgeSnippet}
              </code>
              <CopyButton text={badgeSnippet} label="Copy" />
            </div>
          </div>
        </section>

        {history.length > 1 && (
          <section className="pa-noprint">
            <h2 className="pa-eyebrow mb-3">Recent audits</h2>
            <ul className="flex flex-wrap gap-2">
              {history.slice(0, 8).map((h) => (
                <li key={h.url}>
                  <Link
                    href={`/report?url=${encodeURIComponent(h.url)}`}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-rule bg-card px-2 py-1 font-mono text-xs text-ink-2 hover:border-ink"
                  >
                    <span className="font-semibold">{h.grade}</span>
                    {domainOf(h.url)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
