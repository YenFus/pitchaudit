// Lighthouse result parsing, shared by the local runner (lighthouse.ts) and
// the optional Google PageSpeed Insights fallback.

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


const PSI_ENDPOINT =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CATEGORIES =
  "&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES";
const TIMEOUT_MS = 40_000;

/* eslint-disable @typescript-eslint/no-explicit-any */

function pct(score: unknown): number | undefined {
  return typeof score === "number" ? Math.round(score * 100) : undefined;
}

export function parseSummary(data: any, strategy: "mobile" | "desktop"): PsiSummary {
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

/** Optional fallback when local Chrome isn't available: Google's hosted
 *  PageSpeed Insights API. Only used when PSI_API_KEY is set. Mobile only —
 *  that's the run the scores use. */
export async function runPsiMobile(url: string, key: string): Promise<PsiSummary> {
  const endpoint = `${PSI_ENDPOINT}?url=${encodeURIComponent(url)}&strategy=mobile${CATEGORIES}&key=${encodeURIComponent(key)}`;
  const res = await fetch(endpoint, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`PageSpeed Insights responded ${res.status}`);
  return parseSummary(await res.json(), "mobile");
}
