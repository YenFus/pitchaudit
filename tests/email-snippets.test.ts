import { describe, it, expect } from "vitest";
import { buildSnippets } from "@/lib/email-snippets";
import { IMPACT_COPY } from "@/lib/audit/impact-copy";
import type { Issue } from "@/lib/types";

const issue = (id: string, pitch?: string): Issue => ({
  id,
  category: "seo",
  severity: "warning",
  title: id,
  finding: "f",
  impact: "i",
  fix: "x",
  pitch,
});

const ISSUES: Issue[] = [
  issue("no-https", "The site is served over http rather than https, so browsers may label it “Not secure”."),
  issue("no-hsts"), // real finding, but nothing worth emailing
  issue("slow-ttfb", "The server took about 2.4 seconds to start responding in my check, which is slow."),
  issue("no-og", "Links to the site shared on WhatsApp, Facebook or LinkedIn show up without a preview picture."),
  issue("missing-alts", "4 of 9 images on the homepage have no alt text."),
];

describe("email snippets", () => {
  it("builds four plain templates without a competitor", () => {
    const s = buildSnippets({ domain: "rossisbakery.com", topIssues: ISSUES });
    expect(s.map((x) => x.id)).toEqual(["plain", "short", "report", "formal"]);
  });

  it("quotes the pitch sentences, skipping findings that have none", () => {
    const [plain] = buildSnippets({ domain: "rossisbakery.com", topIssues: ISSUES });
    expect(plain.body).toContain("• The site is served over http");
    expect(plain.body).toContain("• The server took about 2.4 seconds");
    expect(plain.body).toContain("• Links to the site shared on WhatsApp");
    // capped at three bullets, and the un-pitchable HSTS finding never appears
    expect(plain.body.match(/^•/gm)).toHaveLength(3);
    expect(plain.body).not.toContain("alt text");
  });

  it("subjects are specific to the domain", () => {
    const s = buildSnippets({ domain: "rossisbakery.com", topIssues: ISSUES });
    expect(s.find((x) => x.id === "plain")?.subject).toBe("A few things on rossisbakery.com");
    expect(s.find((x) => x.id === "short")?.subject).toContain("rossisbakery.com");
  });

  it("adds the comparison template, phrased without claiming the prospect is losing", () => {
    const s = buildSnippets({ domain: "rossisbakery.com", topIssues: ISSUES, competitor: "citybreads.com" });
    const c = s.find((x) => x.id === "competitor");
    expect(s).toHaveLength(5);
    expect(c?.subject).toBe("rossisbakery.com compared with citybreads.com");
    expect(c?.body).toContain("citybreads.com");
    expect(c?.body).not.toMatch(/beating|losing|behind/i);
  });

  it("falls back gracefully — and makes no claims — when nothing is quotable", () => {
    for (const issues of [[], [issue("no-hsts")]]) {
      const s = buildSnippets({ domain: "clean-site.com", topIssues: issues });
      expect(s).toHaveLength(4);
      for (const t of s) {
        expect(t.body).toContain("clean-site.com");
        expect(t.body).not.toContain("•");
        expect(t.body).not.toContain("undefined");
      }
    }
  });

  it("every draft has a subject, a greeting, and a sign-off placeholder", () => {
    for (const t of buildSnippets({ domain: "a.com", topIssues: ISSUES, competitor: "b.com" })) {
      expect(t.subject.length).toBeGreaterThan(5);
      expect(t.body).toMatch(/^(Hi|Dear) \[First name\],/);
      expect(t.body).toContain("[Your name]");
    }
  });

  it("contains no unsubstantiated outcome claims", () => {
    const all = buildSnippets({ domain: "a.com", topIssues: ISSUES, competitor: "b.com" })
      .map((t) => t.body)
      .join("\n");
    for (const banned of [/lift/i, /increase (in )?(sales|revenue|enquir)/i, /guarantee/i, /our agency/i, /costing you/i, /losing (customers|business)/i]) {
      expect(all).not.toMatch(banned);
    }
  });
});

describe("pitch sentences (written per finding)", () => {
  const raw = (id: string, finding: string, evidence: string[] = []) => ({ id, severity: "warning" as const, finding, evidence });

  it("interpolate real numbers from the finding", () => {
    expect(IMPACT_COPY["bad-title"].pitch?.(raw("bad-title", "the page title is 109 characters (ideal: 15–60)"))).toContain("109 characters");
    expect(IMPACT_COPY["slow-ttfb"].pitch?.(raw("slow-ttfb", "the server took 2.4s to start responding"))).toContain("2.4 seconds");
    expect(IMPACT_COPY["missing-alts"].pitch?.(raw("missing-alts", "7 of 24 images are missing an alt attribute"))).toContain("7 of 24");
    expect(IMPACT_COPY["outdated-copyright"].pitch?.(raw("outdated-copyright", "the footer copyright shows 2019 (7 years out of date)"))).toContain("© 2019");
  });

  it("quotes the phone number that was found", () => {
    const p = IMPACT_COPY["missing-touch-cta"].pitch?.(raw("missing-touch-cta", "x", ["Phone number in the page text: (555) 123-4567"]));
    expect(p).toContain("(555) 123-4567");
  });

  it("distinguishes 'served over http' from 'http doesn't redirect'", () => {
    const a = IMPACT_COPY["no-https"].pitch?.(raw("no-https", "the site is served over plain http:// with no encryption"));
    const b = IMPACT_COPY["no-https"].pitch?.(raw("no-https", "the insecure http:// version of the site loads without redirecting to https://"));
    expect(a).not.toEqual(b);
    expect(a).toContain("served over http");
    expect(b).toContain("without https");
  });

  it("stays silent for findings not worth leading an email with", () => {
    for (const id of ["no-hsts", "no-xcto", "no-referrer-policy", "server-leak", "insecure-cookies", "missing-theme-color"]) {
      expect(IMPACT_COPY[id].pitch).toBeUndefined();
    }
    expect(IMPACT_COPY["bad-h1"].pitch?.(raw("bad-h1", "the page has 3 H1 headings"))).toBe("");
  });

  it("never contains fear language or invented statistics", () => {
    const banned = [/catastroph/i, /single most/i, /costing you/i, /flying blind/i, /infuriat/i, /hostile/i, /\d+% (more|of visitors)/i];
    for (const [id, copy] of Object.entries(IMPACT_COPY)) {
      const text = `${copy.title} ${copy.impact} ${copy.fix}`;
      for (const re of banned) {
        // the one sourced Google figure is allowed
        if (id === "slow-ttfb" && /32%/.test(text)) continue;
        expect(text, `${id} matches ${re}`).not.toMatch(re);
      }
    }
  });
});
