import { describe, it } from "vitest";
import { runAudit } from "@/lib/audit/engine";
import { buildSnippets } from "@/lib/email-snippets";

const SITES_TO_TEST = [
  {
    name: "Berkshire Hathaway",
    url: "https://www.berkshirehathaway.com",
    archetype: "Legacy Enterprise ($1T Market Cap with 1990s raw HTML)",
  },
  {
    name: "Paul Graham",
    url: "https://paulgraham.com",
    archetype: "Iconic Personal Essay Site (Table layout, retro design)",
  },
  {
    name: "Craigslist",
    url: "https://www.craigslist.org",
    archetype: "High-Traffic Minimalist Classifieds (Barebones HTML)",
  },
  {
    name: "Wikipedia",
    url: "https://en.wikipedia.org",
    archetype: "Global Knowledge Base (High accessibility, massive content)",
  },
  {
    name: "GitHub",
    url: "https://github.com",
    archetype: "Tier-1 Modern Enterprise Tech Platform",
  },
];

describe("Diverse Real-World Website Audits", () => {
  for (const site of SITES_TO_TEST) {
    it(`audits ${site.name} (${site.url}) [${site.archetype}]`, async () => {
      console.log(`\n======================================================`);
      console.log(`AUDITING: ${site.name} (${site.url})`);
      console.log(`Archetype: ${site.archetype}`);
      console.log(`======================================================`);

      const start = Date.now();
      let result;
      try {
        result = await runAudit(site.url);
      } catch (err: unknown) {
        console.error(`Audit failed for ${site.url}:`, (err as Error).message);
        throw err;
      }
      const duration = Date.now() - start;

      console.log(`⏱️ Audit Duration: ${duration}ms`);
      console.log(`🌐 Final Resolved URL: ${result.finalUrl}`);
      console.log(`🎯 Overall Grade: ${result.overall.grade} (${result.overall.score}/100)`);
      console.log(`📢 Verdict: ${result.overall.verdict}`);

      console.log(`\n📊 Category Breakdown:`);
      for (const cat of result.categories) {
        console.log(`  - ${cat.label.padEnd(14)}: ${String(cat.score).padStart(3)}/100 [Grade ${cat.grade}]`);
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

      console.log(`\n✉️ Generated Outbound Cold Pitches:`);
      for (const snippet of snippets.slice(0, 2)) {
        console.log(`  [${snippet.label.toUpperCase()}] Subject: "${snippet.subject}"`);
        console.log(`  Body preview:`);
        const lines = snippet.body.split("\n").slice(0, 5);
        for (const line of lines) {
          console.log(`    ${line}`);
        }
        console.log(`    ...`);
      }
    }, 60000); // 60s per site
  }
});
