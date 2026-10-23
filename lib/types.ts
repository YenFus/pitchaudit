export type Grade = "A" | "B" | "C" | "D" | "F";

export type CategoryId =
  | "performance"
  | "seo"
  | "mobile"
  | "security"
  | "accessibility"
  | "strategy";

export type Severity = "critical" | "warning" | "info";

export interface Issue {
  id: string;
  category: CategoryId;
  severity: Severity;
  title: string;
  /** The measured fact, e.g. "http:// did not redirect to https://" */
  finding: string;
  /** Plain-English business consequence */
  impact: string;
  /** One-paragraph fix direction */
  fix: string;
  /** What we actually saw on the page, so the claim can be checked. */
  evidence?: string[];
  /** One plain sentence about this finding, written to drop into an email. */
  pitch?: string;
}

export interface CategoryResult {
  id: CategoryId;
  label: string;
  score: number;
  grade: Grade;
  /** false when the tool that measures this category didn't run. The score
   *  is then only a rough direct-check figure and is left out of the overall
   *  grade. Absent means measured. */
  measured?: boolean;
}

export interface Vitals {
  lcpMs?: number;
  cls?: number;
  inpMs?: number;
}

export interface AuditResult {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  overall: {
    score: number;
    grade: Grade;
    verdict: string;
    /** true when Google's Lighthouse didn't run, so the grade covers only the
     *  categories we could measure directly. */
    provisional?: boolean;
  };
  categories: CategoryResult[];
  issues: Issue[];
  /** base64 data URI from PSI final-screenshot (mobile) */
  screenshot?: string;
  vitals?: Vitals;
  /** Set when PSI failed and scores fall back to direct checks only. */
  psiError?: string;
  pageMeta: { title?: string; description?: string };
}

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  performance: "Performance",
  seo: "SEO",
  mobile: "Mobile",
  security: "Security",
  accessibility: "Accessibility",
  strategy: "Strategy & Branding",
};

// Inked, not neon: every colour clears 4:1 on the paper background.
export const GRADE_COLORS: Record<Grade, string> = {
  A: "#2c6f47",
  B: "#587a1f",
  C: "#a06a00",
  D: "#b8560f",
  F: "#a8261c",
};

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function gradeFor(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

/** Tiebreak within a severity: lead with what a business owner cares about
 *  (lost customers, visibility) before technical hardening. */
const CATEGORY_PITCH_ORDER: Record<CategoryId, number> = {
  strategy: 0,
  mobile: 1,
  seo: 2,
  performance: 3,
  accessibility: 4,
  security: 5,
};

export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      CATEGORY_PITCH_ORDER[a.category] - CATEGORY_PITCH_ORDER[b.category]
  );
}
