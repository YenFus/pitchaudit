import { describe, it, expect } from "vitest";
import { runHtmlAndHeaderChecks } from "@/lib/audit/checks";
import { sortIssues } from "@/lib/types";
import type { Issue } from "@/lib/types";

const YEAR = new Date().getFullYear();

const GOOD_HEADERS = {
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "content-type": "text/html; charset=utf-8",
};

const HEAD = `
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Joe's Pizza — Brooklyn's Neighborhood Slice Shop</title>
  <meta name="description" content="Joe's Pizza serves fresh New York slices, calzones and pasta in Brooklyn since 1985.">
  <link rel="canonical" href="https://joes.example/">
  <link rel="apple-touch-icon" href="/apple.png">
  <link rel="icon" href="/favicon.ico">
  <meta name="theme-color" content="#000">
  <meta property="og:title" content="Joe's"><meta property="og:description" content="d"><meta property="og:image" content="https://joes.example/og.png">
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>`;

/** Wraps body markup in an otherwise clean page and returns issue ids. */
function run(
  body: string,
  opts: { head?: string; headers?: Record<string, string>; setCookies?: string[] } = {}
) {
  const headers = new Headers({ ...GOOD_HEADERS, ...(opts.headers ?? {}) });
  for (const c of opts.setCookies ?? []) headers.append("set-cookie", c);
  const html = `<!DOCTYPE html><html lang="en"><head>${opts.head ?? HEAD}</head>
    <body><header><nav>Home</nav></header><main><h1>Joe's Pizza</h1>
    <p>${"Fresh pizza made daily with real ingredients. ".repeat(30)}</p>
    <a class="btn" href="/order">Order now</a>${body}</main>
    <footer>© ${YEAR} Joe's Pizza. Loved by our customers — read the reviews.</footer></body></html>`;
  const result = runHtmlAndHeaderChecks({
    finalUrl: "https://joes.example/",
    html,
    headers,
    ttfbMs: 200,
  });
  return {
    ids: result.issues.map((i) => i.id),
    issues: result.issues,
    pageMeta: result.pageMeta,
  };
}

describe("false-positive regressions (found auditing real small-business sites)", () => {
  it("baseline page is clean, so the cases below isolate one change each", () => {
    expect(run("").ids).toEqual([]);
  });

  it("reads meta descriptions containing apostrophes in full", () => {
    const r = run("");
    expect(r.ids).not.toContain("bad-meta-desc");
    expect(r.pageMeta.description).toContain("Joe's Pizza serves");
  });

  it("reads single-quoted meta content that contains double quotes", () => {
    const head = HEAD.replace(
      /<meta name="description"[^>]*>/,
      `<meta name="description" content='Order "the works" pizza online from Joe: fresh, hot and delivered fast.'>`
    );
    expect(run("", { head }).ids).not.toContain("bad-meta-desc");
  });

  describe("mixed content", () => {
    it("ignores <link> hints that the browser never loads", () => {
      const head =
        HEAD +
        `<link rel="image_src" href="http://static1.squarespace.com/a.jpg">
         <link rel="profile" href="http://gmpg.org/xfn/11">
         <link rel="alternate" href="http://joes.example/feed">`;
      expect(run("", { head }).ids).not.toContain("mixed-content");
    });

    it("flags real insecure images, scripts and stylesheets", () => {
      expect(run(`<img src="http://cdn.example/a.png" alt="x">`).ids).toContain(
        "mixed-content"
      );
      expect(
        run("", { head: HEAD + `<link rel="stylesheet" href="http://cdn.example/a.css">` }).ids
      ).toContain("mixed-content");
    });
  });

  describe("tap-to-call", () => {
    it("does not treat digit runs inside URLs as phone numbers", () => {
      const body = `<img src="https://images.squarespace-cdn.com/content/v1/5fb3405312797c6fcd738f7a/1605584633387-AFV8/x.jpg" alt="pie">
        <script src="/app.js?ver=1690000000"></script>`;
      expect(run(body).ids).not.toContain("missing-touch-cta");
    });

    it("flags a visible formatted number with no tel: link", () => {
      expect(run(`<p>Call (718) 555-0142 to order</p>`).ids).toContain(
        "missing-touch-cta"
      );
      expect(run(`<p>Call 718.555.0142 to order</p>`).ids).toContain(
        "missing-touch-cta"
      );
    });

    it.each([
      ["UK national", "Call 0113 496 0000 to book"],
      ["UK London", "Phone: 020 7946 0958"],
      ["UK international", "Tel +44 20 7946 0958"],
      ["UK with (0)", "Tel +44 (0)20 7946 0958"],
      ["Australia", "Ring (02) 9876 5432 today"],
      ["India +91", "WhatsApp +91 98765 43210"],
      ["India mobile", "Call 98765 43210"],
      ["Ireland", "Call +353 1 234 5678"],
      ["US with country code", "Call +1 555 123 4567"],
    ])("recognises %s numbers as phone numbers", (_label, text) => {
      expect(run(`<p>${text}</p>`).ids).toContain("missing-touch-cta");
    });

    it.each([
      "Updated 12.03.2024 by the team",
      "Order ref 2024-05-1234 shipped",
      "Version 3.12.1 released",
      "Founded 1985 – 2024",
      "Postcode SW1A 1AA",
      "Price £1 200 000",
      "Open 09:00 – 17:30",
      "See page 12 of 340",
    ])("does not mistake %s for a phone number", (text) => {
      expect(run(`<p>${text}</p>`).ids).not.toContain("missing-touch-cta");
    });

    it("accepts a tel: link, quoted or not", () => {
      expect(
        run(`<a href="tel:+17185550142">Call (718) 555-0142</a>`).ids
      ).not.toContain("missing-touch-cta");
      expect(
        run(`<a href=tel:7185550142>Call 718-555-0142</a>`).ids
      ).not.toContain("missing-touch-cta");
    });
  });

  describe("outdated copyright", () => {
    const withFooter = (text: string) =>
      runHtmlAndHeaderChecks({
        finalUrl: "https://joes.example/",
        html: `<!DOCTYPE html><html lang="en"><head>${HEAD}</head><body><header><nav>x</nav></header><main><h1>Joe</h1><p>${"Fresh pizza daily. ".repeat(40)}</p><a class="btn" href="/o">Order</a></main><footer>${text}</footer></body></html>`,
        headers: new Headers(GOOD_HEADERS),
        ttfbMs: 100,
      }).issues.map((i) => i.id);

    it("does not flag a range whose end year is current", () => {
      expect(withFooter(`© 2010 – ${YEAR} Joe's Pizza`)).not.toContain(
        "outdated-copyright"
      );
      expect(withFooter(`Copyright 2012-${YEAR}`)).not.toContain(
        "outdated-copyright"
      );
    });

    it("does not flag last year", () => {
      expect(withFooter(`© ${YEAR - 1} Joe's`)).not.toContain("outdated-copyright");
    });

    it("flags a genuinely stale year and reports the real gap", () => {
      const r = runHtmlAndHeaderChecks({
        finalUrl: "https://joes.example/",
        html: `<!DOCTYPE html><html lang="en"><head>${HEAD}</head><body><main><h1>Joe</h1><a class="btn" href="/o">Order</a></main><footer>&copy; ${YEAR - 4} Joe's</footer></body></html>`,
        headers: new Headers(GOOD_HEADERS),
        ttfbMs: 100,
      });
      const issue = r.issues.find((i) => i.id === "outdated-copyright");
      expect(issue?.finding).toContain(String(YEAR - 4));
      expect(issue?.finding).toContain("4 years");
    });

    it("uses the newest of several notices", () => {
      expect(withFooter(`© 2015 Map data · © ${YEAR} Joe's Pizza`)).not.toContain(
        "outdated-copyright"
      );
    });
  });

  describe("accessibility", () => {
    const imgs = (alt: string) =>
      Array.from({ length: 4 }, (_, i) => `<img src="/p${i}.jpg"${alt}>`).join("");

    it("treats alt=\"\" (decorative) as valid", () => {
      expect(run(imgs(` alt=""`)).ids).not.toContain("missing-alts");
    });

    it("flags images with no alt attribute at all", () => {
      expect(run(imgs("")).ids).toContain("missing-alts");
    });

    it("ignores tracking pixels and <noscript> fallbacks", () => {
      const body = `${imgs(` alt="pie"`)}
        <noscript><img height="1" width="1" src="https://www.facebook.com/tr?id=1"></noscript>
        <img width="1" height="1" src="https://t.example/p.gif">`;
      expect(run(body).ids).not.toContain("missing-alts");
    });

    it("counts inputs wrapped in <label> as labelled", () => {
      expect(
        run(`<form><label>Your name <input type="text" name="n"></label></form>`).ids
      ).not.toContain("unlabeled-form-inputs");
      expect(
        run(`<form><input type="text" name="n"></form>`).ids
      ).toContain("unlabeled-form-inputs");
    });

    it("ignores hidden honeypot and file inputs", () => {
      const body = `<form>
        <input type="text" name="_app_id" autocomplete="off" tabindex="-1" style="display:none" value="">
        <input type="file" multiple style="display: none">
        <input type="text" name="trap" aria-hidden="true">
        <input hidden name="h">
      </form>`;
      expect(run(body).ids).not.toContain("unlabeled-form-inputs");
      // a visible unlabeled field still counts
      expect(
        run(`<form><input type="text" name="x" style="display:none"><input type="email" name="e"></form>`).ids
      ).toContain("unlabeled-form-inputs");
    });

    it("does not count H1s inside scripts, and multiple real H1s are info-level", () => {
      const inScript = `<script type="text/template"><h1>a</h1><h1>b</h1></script>`;
      expect(run(inScript).ids).not.toContain("bad-h1");
      const multi = run(`<h1>Second</h1>`).issues.find((i) => i.id === "bad-h1");
      expect(multi?.severity).toBe("info");
    });
  });

  describe("length and link-text accuracy (found by comparing with an independent parser)", () => {
    it("counts HTML entities as the characters they render, not their source length", () => {
      // 58 rendered characters, but 62 with "&amp;" spelled out
      const title = "Fritz &amp; Sons Plumbing &amp; Heating — Columbus, Ohio Pros";
      const head = HEAD.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
      expect(run("", { head }).ids).not.toContain("bad-title");
    });

    it("decodes numeric apostrophes in meta descriptions", () => {
      const desc = "Joe&#039;s Pizza serves fresh slices, calzones and pasta in Brooklyn since 1985.";
      const head = HEAD.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${desc}">`);
      const r = run("", { head });
      expect(r.ids).not.toContain("bad-meta-desc");
      expect(r.pageMeta.description).toContain("Joe's Pizza");
    });

    it("still flags a genuinely too-long title", () => {
      const head = HEAD.replace(/<title>[^<]*<\/title>/, `<title>${"Plumber ".repeat(12)}</title>`);
      expect(run("", { head }).ids).toContain("bad-title");
    });

    it("catches vague links wrapped in nested tags or trailing arrows", () => {
      const body = `<a href="/a"><span>Read More</span></a><a href="/b">Learn more »</a>`;
      expect(run(body).ids).toContain("vague-link-text");
    });

    it("does not flag descriptive links that merely contain those words", () => {
      const body = `<a href="/a">Read more about our drain cleaning</a><a href="/b">Learn more: water heaters</a>`;
      expect(run(body).ids).not.toContain("vague-link-text");
    });

    it("needs two vague links before flagging", () => {
      expect(run(`<a href="/a">Read more</a>`).ids).not.toContain("vague-link-text");
    });
  });

  describe("headers", () => {
    it("accepts charset declared in the Content-Type header", () => {
      const head = HEAD.replace('<meta charset="utf-8">', "");
      expect(run("", { head }).ids).not.toContain("missing-charset");
      expect(
        run("", { head, headers: { "content-type": "text/html" } }).ids
      ).toContain("missing-charset");
    });

    it("warns on a missing Secure flag, but only informs on missing SameSite", () => {
      const noSecure = run("", { setCookies: ["a=1; Path=/; SameSite=Lax"] });
      expect(noSecure.issues.find((i) => i.id === "insecure-cookies")?.severity).toBe(
        "warning"
      );
      const noSameSite = run("", { setCookies: ["a=1; Path=/; Secure"] });
      expect(noSameSite.issues.find((i) => i.id === "insecure-cookies")?.severity).toBe(
        "info"
      );
      const fine = run("", { setCookies: ["a=1; Path=/; Secure; SameSite=Lax"] });
      expect(fine.ids).not.toContain("insecure-cookies");
    });

    it("checks every cookie, not just the first", () => {
      const r = run("", {
        setCookies: ["a=1; Secure; SameSite=Lax", "b=2; SameSite=Lax"],
      });
      expect(r.ids).toContain("insecure-cookies");
    });

    it("treats missing frame protection as informational, not a warning", () => {
      const headers = new Headers({ ...GOOD_HEADERS });
      headers.delete("x-frame-options");
      const res = runHtmlAndHeaderChecks({
        finalUrl: "https://joes.example/",
        html: `<!DOCTYPE html><html lang="en"><head>${HEAD}</head><body><main><h1>J</h1><a class="btn" href="/o">o</a></main></body></html>`,
        headers,
        ttfbMs: 100,
      });
      expect(res.issues.find((i) => i.id === "no-frame-protection")?.severity).toBe(
        "info"
      );
    });

    it.each([
      "width=device-width, initial-scale=1, user-scalable=no",
      "width=device-width, initial-scale=1.0, user-scalable=0",
      "width=device-width, user-scalable=false",
      "width=device-width, initial-scale=1, maximum-scale=1.0",
    ])("flags disabled pinch-zoom: %s", (content) => {
      const head = HEAD.replace(/<meta name="viewport"[^>]*>/, `<meta name="viewport" content="${content}">`);
      expect(run("", { head }).ids).toContain("disabled-pinch-zoom");
    });

    it("does not flag a normal viewport tag", () => {
      expect(run("").ids).not.toContain("disabled-pinch-zoom");
      const head = HEAD.replace(/<meta name="viewport"[^>]*>/, `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes">`);
      expect(run("", { head }).ids).not.toContain("disabled-pinch-zoom");
    });

    it("only flags slow TTFB on a clear miss", () => {
      const at = (ttfbMs: number) =>
        runHtmlAndHeaderChecks({
          finalUrl: "https://joes.example/",
          html: `<!DOCTYPE html><html lang="en"><head>${HEAD}</head><body><main><h1>J</h1></main></body></html>`,
          headers: new Headers(GOOD_HEADERS),
          ttfbMs,
        }).issues.some((i) => i.id === "slow-ttfb");
      expect(at(1000)).toBe(false);
      expect(at(1400)).toBe(false);
      expect(at(1800)).toBe(true);
    });
  });

  describe("strategy detection", () => {
    const noAnalyticsHead = HEAD.replace(/<script async[^>]*><\/script>/, "");

    it("flags a page with no analytics at all", () => {
      expect(run("", { head: noAnalyticsHead }).ids).toContain("missing-analytics");
    });

    it.each([
      `<script defer src="https://static.cloudflareinsights.com/beacon.min.js"></script>`,
      `<script defer data-domain="joes.example" src="https://plausible.io/js/script.js"></script>`,
      `<script>window.dataLayer = window.dataLayer || [];</script>`,
      `<script src="https://cdn.matomo.cloud/joes/matomo.js"></script>`,
      `<script>!function(f,b,e,v){fbq('init','1')}</script>`,
    ])("recognises common analytics: %s", (tag) => {
      expect(run("", { head: noAnalyticsHead + tag }).ids).not.toContain(
        "missing-analytics"
      );
    });

    it("counts styled link buttons and tel: links as a call to action", () => {
      const bare = `<!DOCTYPE html><html lang="en"><head>${HEAD}</head><body><main><h1>J</h1><p>${"Text here. ".repeat(80)}</p>`;
      const check = (extra: string) =>
        runHtmlAndHeaderChecks({
          finalUrl: "https://joes.example/",
          html: `${bare}${extra}</main></body></html>`,
          headers: new Headers(GOOD_HEADERS),
          ttfbMs: 100,
        }).issues.some((i) => i.id === "missing-primary-cta");
      expect(check("")).toBe(true);
      expect(check(`<div class="wp-block-button"><a class="wp-block-button__link" href="/o">Order</a></div>`)).toBe(false);
      expect(check(`<a href="tel:+17185550142">Call us</a>`)).toBe(false);
      expect(check(`<a role="button" href="/o">Order</a>`)).toBe(false);
    });
  });
});

describe("sortIssues", () => {
  const mk = (id: string, category: Issue["category"], severity: Issue["severity"]): Issue => ({
    id,
    category,
    severity,
    title: id,
    finding: "",
    impact: "",
    fix: "",
  });

  it("orders by severity first", () => {
    const sorted = sortIssues([
      mk("i", "strategy", "info"),
      mk("c", "security", "critical"),
      mk("w", "seo", "warning"),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["c", "w", "i"]);
  });

  it("within a severity, leads with business-facing categories over security", () => {
    const sorted = sortIssues([
      mk("sec", "security", "warning"),
      mk("a11y", "accessibility", "warning"),
      mk("seo", "seo", "warning"),
      mk("mob", "mobile", "warning"),
      mk("strat", "strategy", "warning"),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["strat", "mob", "seo", "a11y", "sec"]);
  });
});

describe("unquoted attributes (minified HTML, e.g. example.com)", () => {
  // example.com's real homepage, verbatim.
  const EXAMPLE_COM =
    '<!doctype html><html lang=en><head><meta charset=utf-8><link rel=icon href=data:,><meta name=viewport content="width=device-width,initial-scale=1"><title>Example Domain</title></head><body><p>This domain is for use in documentation examples.</p></body></html>';

  const ids = (html: string) =>
    runHtmlAndHeaderChecks({
      finalUrl: "https://example.com/",
      html,
      headers: new Headers({ "content-type": "text/html" }),
      ttfbMs: 100,
    }).issues.map((i) => i.id);

  it("sees the viewport, language and charset on example.com", () => {
    const found = ids(EXAMPLE_COM);
    expect(found).not.toContain("no-viewport");
    expect(found).not.toContain("missing-lang");
    expect(found).not.toContain("missing-charset");
  });

  it.each([
    ["meta description", '<meta name=description content="A clear, useful description of a family-run bakery in the city centre.">', "bad-meta-desc"],
    ["canonical", "<link rel=canonical href=/>", "no-canonical"],
    ["theme colour", "<meta name=theme-color content=#000>", "missing-theme-color"],
    ["apple touch icon", "<link rel=apple-touch-icon href=/a.png>", "missing-apple-touch-icon"],
    ["social tags", "<meta property=og:title content=x><meta property=og:description content=y><meta property=og:image content=/z.png>", "no-og"],
  ])("recognises an unquoted %s", (_label, tag, id) => {
    expect(ids(EXAMPLE_COM.replace("</head>", `${tag}</head>`))).not.toContain(id);
  });

  it("still flags a missing viewport", () => {
    expect(ids(EXAMPLE_COM.replace(/<meta name=viewport[^>]*>/, ""))).toContain("no-viewport");
  });

  it("doesn't read across attributes when unquoted", () => {
    // rel=stylesheet, with "icon" only in the href: not a favicon declaration,
    // and no theme-color hidden in another attribute.
    const html = EXAMPLE_COM.replace("<link rel=icon href=data:,>", "<link rel=stylesheet href=/icon.css>").replace(
      "</head>",
      "<meta name=generator content=theme-color></head>"
    );
    expect(ids(html)).toContain("missing-theme-color");
  });
});

