// Google PageSpeed Insights fetcher — mobile + desktop in parallel.
// Free API; optional PSI_API_KEY env var raises the daily quota.

export interface PsiOpportunity {
  id: string;
  title: string;
  description: string;
  savingsMs: number;
  displayValue?: string;
}

export interface PsiSummary {
  scores: {
    performance?: number;
    seo?: number;
    accessibility?: number;
    bestPractices?: number;
  };
  labVitals: { lcpMs?: number; cls?: number; tbtMs?: number };
  fieldMetrics?: { lcpMs?: number; cls?: number; inpMs?: number };
  screenshot?: string;
  opportunities: PsiOpportunity[];
}

export interface PsiResult {
  mobile: PsiSummary | null;
  desktop: PsiSummary | null;
  error?: string;
}

const PSI_ENDPOINT =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CATEGORIES =
  "&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES";
const TIMEOUT_MS = 40_000;

/* eslint-disable @typescript-eslint/no-explicit-any */

function pct(score: unknown): number | undefined {
  return typeof score === "number" ? Math.round(score * 100) : undefined;
}

function parseSummary(data: any, strategy: "mobile" | "desktop"): PsiSummary {
  const lh = data?.lighthouseResult ?? {};
  const cats = lh.categories ?? {};
  const audits = lh.audits ?? {};

  const opportunities: PsiOpportunity[] = Object.values<any>(audits)
    .filter(
      (a) =>
        a?.details?.type === "opportunity" &&
        typeof a.score === "number" &&
        a.score < 0.9
    )
    .map((a) => ({
      id: a.id as string,
      title: a.title as string,
      description: (a.description as string) ?? "",
      savingsMs: (a.details?.overallSavingsMs as number) ?? 0,
      displayValue: a.displayValue as string | undefined,
    }))
    .sort((a, b) => b.savingsMs - a.savingsMs)
    .slice(0, 5);

  const field = data?.loadingExperience?.metrics;
  const fieldMetrics = field
    ? {
        lcpMs: field.LARGEST_CONTENTFUL_PAINT_MS?.percentile as
          | number
          | undefined,
        cls:
          typeof field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile === "number"
            ? field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
            : undefined,
        inpMs: field.INTERACTION_TO_NEXT_PAINT?.percentile as
          | number
          | undefined,
      }
    : undefined;

  return {
    scores: {
      performance: pct(cats.performance?.score),
      seo: pct(cats.seo?.score),
      accessibility: pct(cats.accessibility?.score),
      bestPractices: pct(cats["best-practices"]?.score),
    },
    labVitals: {
      lcpMs: audits["largest-contentful-paint"]?.numericValue as
        | number
        | undefined,
      cls: audits["cumulative-layout-shift"]?.numericValue as
        | number
        | undefined,
      tbtMs: audits["total-blocking-time"]?.numericValue as number | undefined,
    },
    fieldMetrics,
    screenshot:
      strategy === "mobile"
        ? (audits["final-screenshot"]?.details?.data as string | undefined)
        : undefined,
    opportunities,
  };
}

let warnedMissingKey = false;
/** Without PSI_API_KEY Google's shared quota runs out fast and every audit
 *  silently degrades to direct checks. Say so once, loudly, in the logs. */
function warnMissingPsiKey(): void {
  if (warnedMissingKey) return;
  warnedMissingKey = true;
  console.warn(
    "[pitchaudit] PageSpeed Insights returned 429 and PSI_API_KEY is not set. " +
      "Performance/Mobile scores are falling back to direct checks. " +
      "Set PSI_API_KEY (free) — see README Step 3."
  );
}

async function fetchStrategy(
  url: string,
  strategy: "mobile" | "desktop"
): Promise<PsiSummary> {
  const key = process.env.PSI_API_KEY;
  const endpoint = `${PSI_ENDPOINT}?url=${encodeURIComponent(
    url
  )}&strategy=${strategy}${CATEGORIES}${key ? `&key=${key}` : ""}`;
  const res = await fetch(endpoint, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    if (res.status === 429 && !key) warnMissingPsiKey();
    throw new Error(`PSI ${strategy} responded ${res.status}`);
  }
  return parseSummary(await res.json(), strategy);
}

export async function runPsi(url: string): Promise<PsiResult> {
  const [mobile, desktop] = await Promise.allSettled([
    fetchStrategy(url, "mobile"),
    fetchStrategy(url, "desktop"),
  ]);
  const result: PsiResult = {
    mobile: mobile.status === "fulfilled" ? mobile.value : null,
    desktop: desktop.status === "fulfilled" ? desktop.value : null,
  };
  if (!result.mobile && !result.desktop) {
    // The reason stays in the server log; clients only learn that it failed.
    if (mobile.status === "rejected") console.warn("[pitchaudit] PSI failed:", mobile.reason);
    result.error = "PageSpeed Insights unavailable";
  }
  return result;
}
