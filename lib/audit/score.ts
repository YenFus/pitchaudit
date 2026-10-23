// Grading formulas. Category scores blend PSI (mobile) with our direct
// checks; when PSI is down we degrade to checks-only so an audit always
// completes.

import type { CategoryId, CategoryResult, Grade, Issue } from "../types";
import { CATEGORY_LABELS, gradeFor } from "../types";
import type { PsiSummary } from "./psi";

const SEVERITY_PENALTY = { critical: 25, warning: 10, info: 4 } as const;

export const VERDICTS: Record<Grade, string> = {
  A: "The fundamentals are solid. What's left is polish.",
  B: "Good foundations, with a handful of fixes worth making.",
  C: "Several things are worth fixing. None is hard, and together they add up.",
  D: "A lot needs attention here, starting with anything marked Critical or Warning.",
  F: "This site has serious problems that are worth fixing before anything else.",
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** 100 minus penalties for failed checks in a category. */
function checkScore(issues: Issue[], category: CategoryId): number {
  const penalty = issues
    .filter((i) => i.category === category && !i.id.startsWith("psi:"))
    .reduce((sum, i) => sum + SEVERITY_PENALTY[i.severity], 0);
  return Math.max(0, 100 - penalty);
}

// Category weights in the overall grade.
const WEIGHTS: Record<CategoryId, number> = {
  performance: 0.25,
  seo: 0.25,
  strategy: 0.15,
  mobile: 0.15,
  security: 0.1,
  accessibility: 0.1,
};

export function computeScores(
  issues: Issue[],
  psiMobile: PsiSummary | null,
  viewportPass: boolean
): {
  overall: { score: number; grade: Grade; verdict: string; provisional?: boolean };
  categories: CategoryResult[];
} {
  const s = psiMobile?.scores;
  // Lighthouse is the only real measurement of speed and of most accessibility
  // rules. Without it those two categories have no honest number, so they're
  // shown as "not measured" and left out of the overall grade rather than
  // handing every site a flattering A.
  const lighthouse = s?.performance !== undefined;

  const perfChecks = checkScore(issues, "performance");
  const performance =
    s?.performance !== undefined
      ? 0.7 * s.performance + 0.3 * perfChecks
      : perfChecks;

  const seoChecks = checkScore(issues, "seo");
  const seo = s?.seo !== undefined ? 0.5 * s.seo + 0.5 * seoChecks : seoChecks;

  const a11yChecks = checkScore(issues, "accessibility");
  const accessibility =
    s?.accessibility !== undefined
      ? 0.8 * s.accessibility + 0.2 * a11yChecks
      : a11yChecks;

  let security = checkScore(issues, "security");
  if (s?.bestPractices !== undefined && s.bestPractices < 70) security -= 10;
  security = Math.max(0, security);

  const mobileChecks = checkScore(issues, "mobile");
  const viewportScore = viewportPass ? 100 : 0;
  const directMobile = Math.min(viewportScore, mobileChecks);
  const mobile =
    s?.performance !== undefined
      ? 0.5 * s.performance + 0.5 * directMobile
      : directMobile;

  const strategy = checkScore(issues, "strategy");

  const values: Record<CategoryId, number> = {
    performance: clamp(performance),
    seo: clamp(seo),
    mobile: clamp(mobile),
    security: clamp(security),
    accessibility: clamp(accessibility),
    strategy: clamp(strategy),
  };

  const unmeasured = new Set<CategoryId>(
    lighthouse ? [] : ["performance", "accessibility"]
  );
  let weighted = 0;
  let weightSum = 0;
  for (const id of Object.keys(WEIGHTS) as CategoryId[]) {
    if (unmeasured.has(id)) continue;
    weighted += WEIGHTS[id] * values[id];
    weightSum += WEIGHTS[id];
  }
  const overallScore = clamp(weighted / weightSum);
  const grade = gradeFor(overallScore);

  const order: CategoryId[] = [
    "performance",
    "seo",
    "mobile",
    "security",
    "accessibility",
    "strategy",
  ];
  return {
    overall: {
      score: overallScore,
      grade,
      verdict: VERDICTS[grade],
      ...(lighthouse ? {} : { provisional: true }),
    },
    categories: order.map((id) => ({
      id,
      label: CATEGORY_LABELS[id],
      score: values[id],
      grade: gradeFor(values[id]),
      ...(unmeasured.has(id) ? { measured: false } : {}),
    })),
  };
}
