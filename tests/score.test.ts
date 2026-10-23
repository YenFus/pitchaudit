import { describe, it, expect } from "vitest";
import { computeScores } from "@/lib/audit/score";
import { gradeFor, type Issue } from "@/lib/types";

describe("Scoring and Grading engine", () => {
  it("determines correct letter grade for score ranges", () => {
    expect(gradeFor(100)).toBe("A");
    expect(gradeFor(90)).toBe("A");
    expect(gradeFor(89)).toBe("B");
    expect(gradeFor(75)).toBe("B");
    expect(gradeFor(74)).toBe("C");
    expect(gradeFor(60)).toBe("C");
    expect(gradeFor(59)).toBe("D");
    expect(gradeFor(45)).toBe("D");
    expect(gradeFor(44)).toBe("F");
    expect(gradeFor(0)).toBe("F");
  });

  it("calculates clean scores for a site with zero issues and high PSI", () => {
    const psiMobile = {
      scores: {
        performance: 95,
        seo: 100,
        accessibility: 98,
        bestPractices: 100,
      },
      labVitals: { lcpMs: 1200, cls: 0.02, tbtMs: 50 },
      opportunities: [],
    };
    const { overall, categories } = computeScores([], psiMobile, true);

    expect(overall.score).toBeGreaterThanOrEqual(90);
    expect(overall.grade).toBe("A");
    expect(categories.length).toBe(6);
    expect(categories.find((c) => c.id === "performance")?.score).toBeGreaterThanOrEqual(90);
    expect(categories.find((c) => c.id === "strategy")?.score).toBe(100);
  });

  it("penalizes critical issues heavily", () => {
    const issues: Issue[] = [
      {
        id: "no-https",
        category: "security",
        severity: "critical",
        title: "Site is reachable without encryption",
        finding: "no https",
        impact: "bad",
        fix: "fix",
      },
      {
        id: "no-hsts",
        category: "security",
        severity: "warning",
        title: "Missing HSTS",
        finding: "no hsts",
        impact: "bad",
        fix: "fix",
      },
    ];

    const { categories } = computeScores(issues, null, true);
    const sec = categories.find((c) => c.id === "security");
    // 100 - 25 (critical) - 10 (warning) = 65
    expect(sec?.score).toBe(65);
    expect(sec?.grade).toBe("C");
  });

  it("degrades gracefully to direct checks when PSI is completely unavailable", () => {
    const issues: Issue[] = [
      {
        id: "slow-ttfb",
        category: "performance",
        severity: "warning",
        title: "Slow server response",
        finding: "1.2s",
        impact: "bad",
        fix: "fix",
      },
    ];

    const { overall, categories } = computeScores(issues, null, true);
    expect(overall.score).toBeGreaterThan(0);
    expect(categories.find((c) => c.id === "performance")?.score).toBe(90); // 100 - 10
  });

  describe("when Google's Lighthouse didn't run", () => {
    const clean = { scores: { performance: 95, seo: 100, accessibility: 98, bestPractices: 100 }, labVitals: {}, opportunities: [] };

    it("marks performance and accessibility as not measured and the overall as provisional", () => {
      const { overall, categories } = computeScores([], null, true);
      expect(overall.provisional).toBe(true);
      const unmeasured = categories.filter((c) => c.measured === false).map((c) => c.id).sort();
      expect(unmeasured).toEqual(["accessibility", "performance"]);
    });

    it("does not let unmeasured categories inflate the overall grade", () => {
      // A site with real SEO problems: unmeasured 100s must not dilute them.
      const seoIssues: Issue[] = Array.from({ length: 4 }, (_, i) => ({
        id: `seo-${i}`, category: "seo" as const, severity: "warning" as const,
        title: "t", finding: "f", impact: "i", fix: "x",
      }));
      const withoutLh = computeScores(seoIssues, null, true).overall.score;
      // Same issues, but if perf+a11y (both 100) were averaged in at 35% weight
      // the score would be higher. Recompute that naive way:
      const cats = computeScores(seoIssues, null, true).categories;
      const v = Object.fromEntries(cats.map((c) => [c.id, c.score])) as Record<string, number>;
      const naive = Math.round(0.25 * v.performance + 0.25 * v.seo + 0.15 * v.strategy + 0.15 * v.mobile + 0.1 * v.security + 0.1 * v.accessibility);
      expect(withoutLh).toBeLessThan(naive);
    });

    it("renormalises the weights over what was measured", () => {
      // Everything measured is perfect -> overall must be 100, not 65.
      const { overall } = computeScores([], null, true);
      expect(overall.score).toBe(100);
    });

    it("leaves measured runs untouched", () => {
      const { overall, categories } = computeScores([], clean, true);
      expect(overall.provisional).toBeUndefined();
      expect(categories.every((c) => c.measured === undefined)).toBe(true);
    });
  });

  it("penalizes mobile category when viewport is missing", () => {
    const { categories } = computeScores([], null, false);
    const mobile = categories.find((c) => c.id === "mobile");
    expect(mobile?.score).toBe(0);
    expect(mobile?.grade).toBe("F");
  });
});
