import { describe, it, expect } from "vitest";
import { runHtmlAndHeaderChecks } from "@/lib/audit/checks";

const HEADERS = new Headers({ "content-type": "text/html; charset=utf-8" });

function issuesFor(html: string, headers = HEADERS, finalUrl = "https://acme.example/") {
  const { issues } = runHtmlAndHeaderChecks({ finalUrl, html, headers, ttfbMs: 2100 });
  return Object.fromEntries(issues.map((i) => [i.id, i]));
}

const PAGE = `<!DOCTYPE html><html><head>
  <title>Acme Plumbing</title>
  <meta name="description" content="">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
</head><body>
  <p>Call us on (555) 123-4567 — © 2019 Acme Plumbing. All rights reserved.</p>
  <img src="/uploads/2023/van-photo.jpg"><img src="/uploads/team.png"><img src="https://cdn.acme.example/logo.svg" alt="Acme">
  <img src="http://cdn.acme.example/old-banner.jpg" alt="banner">
  <a href="/services">Read more</a><a href="/about"><span>Read more</span></a>
  <h1>Acme</h1><h1>Second heading</h1>
</body></html>`;

describe("finding evidence", () => {
  const found = issuesFor(PAGE);

  it("quotes the actual title with its length", () => {
    expect(found["bad-title"].evidence).toEqual(["<title>Acme Plumbing</title>", "13 characters"]);
  });

  it("shows the empty meta description tag it found", () => {
    expect(found["bad-meta-desc"].evidence?.[0]).toContain('name="description"');
  });

  it("names the phone number and the missing tel: link", () => {
    const ev = found["missing-touch-cta"].evidence ?? [];
    expect(ev[0]).toContain("(555) 123-4567");
    expect(ev[1]).toContain("tel:");
  });

  it("lists the images that lack alt text by file name", () => {
    const ev = found["missing-alts"]?.evidence ?? [];
    // 2 of 4 lack alt — below the 80% coverage bar only if 3+ images and <80% covered
    expect(ev.join(" ")).toContain("van-photo.jpg");
    expect(ev.join(" ")).toContain("team.png");
  });

  it("gives the exact insecure URL for mixed content", () => {
    expect(found["mixed-content"].evidence).toEqual(["http://cdn.acme.example/old-banner.jpg"]);
  });

  it("shows the copyright text it read", () => {
    expect(found["outdated-copyright"].evidence?.[0]).toContain("© 2019 Acme Plumbing");
  });

  it("lists vague links with their targets, including tag-wrapped ones", () => {
    const ev = found["vague-link-text"].evidence ?? [];
    expect(ev).toHaveLength(2);
    expect(ev[0]).toBe('"Read more" → /services');
    expect(ev[1]).toBe('"Read more" → /about');
  });

  it("quotes the offending viewport tag and the H1 texts", () => {
    expect(found["disabled-pinch-zoom"].evidence?.[0]).toContain("user-scalable=no");
    expect(found["bad-h1"].evidence).toEqual(['<h1> "Acme"', '<h1> "Second heading"']);
  });

  it("reports the measured response time with an honest caveat", () => {
    const ev = found["slow-ttfb"].evidence ?? [];
    expect(ev[0]).toContain("2100 ms");
    expect(ev[1]).toMatch(/single measurement/i);
  });

  it("names the headers that are absent", () => {
    expect(found["no-hsts"].evidence).toEqual(["Response header strict-transport-security: not present"]);
    expect(found["no-frame-protection"].evidence?.[0]).toContain("x-frame-options");
  });

  it("names which cookie lacks the flag", () => {
    const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
    headers.append("set-cookie", "session=abc; Path=/; SameSite=Lax");
    const f = issuesFor(PAGE, headers);
    expect(f["insecure-cookies"].evidence).toEqual(['Cookie "session" has no Secure flag']);
  });

  it("never emits an empty or whitespace-only evidence line", () => {
    for (const issue of Object.values(found)) {
      for (const line of issue.evidence ?? []) {
        expect(line.trim().length).toBeGreaterThan(0);
        expect(line.length).toBeLessThan(400);
      }
    }
  });

  it("every direct-check issue on a messy page carries evidence", () => {
    const missing = Object.values(found)
      .filter((i) => !i.evidence || i.evidence.length === 0)
      .map((i) => i.id);
    expect(missing).toEqual([]);
  });
});
