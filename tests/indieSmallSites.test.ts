import { describe, it, expect } from "vitest";
import { runAudit } from "@/lib/audit/engine";
import { buildSnippets } from "@/lib/email-snippets";

const INDIE_AND_SMALL_SITES = [
  {
    name: "Dan Luu",
    url: "https://danluu.com",
    archetype: "Indie Solo Engineer (Minimalist, raw HTML, zero-dependency blog)",
  },
  {
    name: "Tiny Projects",
    url: "https://tinyprojects.dev",
    archetype: "Indie Maker Blog & Newsletter (Solopreneur web experiments)",
  },
  {
    name: "Buttondown",
    url: "https://buttondown.com",
    archetype: "Solo Founder Micro-SaaS (Independent newsletter platform)",
  },
  {
    name: "Carrd",
    url: "https://carrd.co",
    archetype: "One-Person Bootstrapped Platform (Iconic solo-built site builder)",
  },
  {
    name: "UseFathom",
    url: "https://usefathom.com",
    archetype: "Independent Privacy Tech Company (Bootstrapped 2-person team)",
  },
  {
    name: "Counter Culture Coffee",
    url: "https://counterculturecoffee.com",
    archetype: "Independent Specialty Roaster (Direct-trade boutique ecommerce)",
  },
  {
    name: "Levels.io",
    url: "https://levels.io",
    archetype: "Iconic Solopreneur (Pieter Levels' portfolio, raw PHP/JS)",
  },
  {
    name: "Cal.com",
    url: "https://cal.com",
    archetype: "Modern Open-Source Startup (Next.js scheduling platform)",
  },
];

describe("Indie, Solopreneur & Small Business Website Audits", () => {
  for (const site of INDIE_AND_SMALL_SITES) {
    it(`audits ${site.name} (${site.url}) [${site.archetype}]`, async () => {
      console.log(`\n======================================================`);
      console.log(`AUDITING: ${site.name} (${site.url})`);
      console.log(`Archetype: ${site.archetype}`);
      console.log(`======================================================`);

      const start = Date.now();
      const result = await runAudit(site.url);
      const duration = Date.now() - start;

      console.log(`⏱️ Audit Duration: ${duration}ms`);
      console.log(`🌐 Final Resolved URL: ${result.finalUrl}`);
      console.log(`🎯 Overall Grade: ${result.overall.grade} (${result.overall.score}/100)`);
      console.log(`📢 Verdict: ${result.overall.verdict}`);

      console.log(`\n📊 Category Breakdown:`);
      for (const cat of result.categories) {
        console.log(`  - ${cat.label.padEnd(21)}: ${String(cat.score).padStart(3)}/100 [Grade ${cat.grade}]`);
      }

      console.log(`\n🔍 Issues Found (${result.issues.length} total):`);
      if (result.issues.length === 0) {
        console.log(`  (No issues detected — site passed all checks)`);
      } else {
        result.issues.forEach((issue, idx) => {
          console.log(`  ${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.title} (${issue.category})`);
          console.log(`     Finding: ${issue.finding}`);
          console.log(`     Impact:  ${issue.impact.slice(0, 100)}...`);
        });
      }

      const domain = new URL(result.finalUrl).hostname.replace(/^www\./, "");
      const topIssues = result.issues;
      const snippets = buildSnippets({
        domain,
        topIssues,
      });

      console.log(`\n✉️ Generated Outbound Pitch Snippet (${snippets[0]?.label ?? "agency"}):`);
      if (snippets.length > 0) {
        console.log(`  Subject: "${snippets[0].subject}"`);
        const lines = snippets[0].body.split("\n").slice(0, 5);
        for (const line of lines) {
          console.log(`    ${line}`);
        }
        console.log(`    ...`);
      }

      // Assertions to verify complete 6-pillar integrity
      expect(result.finalUrl).toBeDefined();
      expect(["A", "B", "C", "D", "F"]).toContain(result.overall.grade);
      expect(result.overall.score).toBeGreaterThan(0);
      expect(result.categories.length).toBe(6);
      expect(result.categories.map((c) => c.id).sort()).toEqual(
        ["accessibility", "mobile", "performance", "security", "seo", "strategy"].sort()
      );
      expect(Array.isArray(result.issues)).toBe(true);
      expect(snippets.length).toBeGreaterThanOrEqual(4);
    }, 60000);
  }
});
