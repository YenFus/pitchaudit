import { describe, it, expect } from "vitest";
import { runAudit } from "@/lib/audit/engine";
import { buildSnippets } from "@/lib/email-snippets";

describe("Live Public Website Audit - news.ycombinator.com", () => {
  it("audits Hacker News and generates cold email pitches", async () => {
    const targetUrl = "https://news.ycombinator.com";
    console.log(`Auditing Hacker News: ${targetUrl}...`);
    
    const result = await runAudit(targetUrl);
    
    console.log("\n=== AUDIT REPORT: news.ycombinator.com ===");
    console.log(`Final URL: ${result.finalUrl}`);
    console.log(`Overall Grade: ${result.overall.grade} (${result.overall.score}/100)`);
    console.log(`Verdict: ${result.overall.verdict}`);
    console.log("\n--- Category Scores ---");
    result.categories.forEach(c => {
      console.log(`- ${c.label}: ${c.score}/100 [Grade ${c.grade}]`);
    });
    console.log("\n--- Detected Issues ---");
    result.issues.forEach((issue, idx) => {
      console.log(`${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.title} (${issue.category})`);
      console.log(`   Finding: ${issue.finding}`);
      console.log(`   Impact: ${issue.impact.slice(0, 80)}...`);
    });

    // Test cold email generation from real audit findings
    const domain = "news.ycombinator.com";
    const snippets = buildSnippets({
      domain,
      topIssues: result.issues,
      competitor: "reddit.com",
    });

    console.log("\n--- Cold Outreach Pitches Generated ---");
    snippets.forEach(s => {
      console.log(`\n[Template: ${s.label}]`);
      console.log(`Subject: ${s.subject}`);
      console.log(`Body Snippet:\n${s.body.slice(0, 150)}...`);
    });

    expect(result.finalUrl).toContain("news.ycombinator.com");
    expect(result.overall.score).toBeGreaterThan(0);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(snippets.length).toBe(5);
  }, 60000);
});
