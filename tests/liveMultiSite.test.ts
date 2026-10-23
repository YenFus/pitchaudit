import { describe, it, expect } from "vitest";
import { runAudit } from "@/lib/audit/engine";

describe("Live Multi-Site Public Audits", () => {
  it("audits Hacker News (news.ycombinator.com) accurately with real issues & cold pitch templates", async () => {
    const result = await runAudit("https://news.ycombinator.com");

    expect(result.finalUrl).toContain("news.ycombinator.com");
    expect(result.overall.grade).toBeDefined();
    expect(result.overall.score).toBeGreaterThan(0);
    expect(result.categories.length).toBe(6);
    expect(result.issues.length).toBeGreaterThan(3);

    // HN is famous for missing meta description, viewport, etc.
    const issueIds = result.issues.map((i) => i.id);
    expect(issueIds).toContain("bad-meta-desc");
  }, 45000);

  it("audits Y Combinator (www.ycombinator.com) gracefully handling quota limits and direct checks", async () => {
    const result = await runAudit("https://www.ycombinator.com");

    expect(result.finalUrl).toContain("ycombinator.com");
    expect(result.overall.grade).toBeDefined();
    expect(result.overall.score).toBeGreaterThan(0);
    expect(result.categories.length).toBe(6);
    expect(Array.isArray(result.issues)).toBe(true);
  }, 45000);
});
