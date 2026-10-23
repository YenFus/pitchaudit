import { describe, it, expect } from "vitest";
import { runAudit } from "@/lib/audit/engine";

describe("Live Official Public Website Audit Test", () => {
  it("successfully audits an official public website (ycombinator.com)", async () => {
    const targetUrl = "https://www.ycombinator.com";
    console.log(`Starting real-world audit against ${targetUrl}...`);
    const startTime = Date.now();
    
    const result = await runAudit(targetUrl);
    const elapsed = Date.now() - startTime;
    
    console.log(`Audit completed in ${elapsed}ms`);
    console.log("Overall Score:", result.overall);
    console.log("Categories:", result.categories);
    console.log("Total Issues Found:", result.issues.length);
    console.log("Top 3 Issues:", result.issues.slice(0, 3).map(i => ({ id: i.id, title: i.title, severity: i.severity, finding: i.finding })));
    console.log("Vitals:", result.vitals);
    console.log("Lighthouse error (if any):", result.lighthouseError);

    expect(result.finalUrl).toBeDefined();
    expect(result.overall.score).toBeGreaterThan(0);
    expect(result.overall.grade).toBeDefined();
    expect(["A", "B", "C", "D", "F"]).toContain(result.overall.grade);
    expect(result.categories.length).toBe(6);
    expect(result.categories.some((c) => c.id === "strategy")).toBe(true);
    expect(Array.isArray(result.issues)).toBe(true);
  }, 60000); // 60s timeout for live Google Lighthouse & checks
});
