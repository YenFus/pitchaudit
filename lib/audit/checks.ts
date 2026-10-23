// Direct-fetch checks — the checks that don't need Lighthouse.
// Each failed check emits {id, severity, finding}; title/impact/fix copy
// is merged in from impact-copy.ts by the engine.

import type { Severity } from "../types";

export interface RawIssue {
  id: string;
  severity: Severity;
  finding: string;
  /** What we actually saw on the page — lets a freelancer defend the claim. */
  evidence?: string[];
}

export interface ChecksResult {
  finalUrl: string;
  ttfbMs: number;
  htmlBytes: number;
  viewportPass: boolean;
  pageMeta: { title?: string; description?: string };
  issues: RawIssue[];
}

import { assertAllowedUrl, assertSafePublicHost, InvalidUrlError, UnreachableError } from "./ssrf";
import { BodyTooLargeError, guardedRequest } from "./transport";
export { UnreachableError, InvalidUrlError };

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 (compatible; PitchAudit/1.0; +https://pitchaudit.vercel.app)";

export async function safeFetch(
  initialUrl: string,
  options: {
    timeoutMs?: number;
    maxRedirects?: number;
    headers?: Record<string, string>;
    method?: string;
    followRedirects?: boolean;
  } = {}
): Promise<{ res: Response; finalUrl: string; ttfbMs: number }> {
  let currentUrl = initialUrl;
  let redirects = 0;
  const maxRedirects = options.maxRedirects ?? 5;
  const timeoutMs = options.timeoutMs ?? 15_000;
  // Time to response headers for the hop that served the document — DNS
  // safety checks and earlier redirect hops are not the server's fault.
  let hopMs = 0;

  while (true) {
    const parsed = new URL(currentUrl);
    // Checked on every hop, so a redirect can't reach a private host or an odd port.
    assertAllowedUrl(parsed);
    await assertSafePublicHost(parsed.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const hopStarted = Date.now();

    let res: Response;
    try {
      res = await guardedRequest(currentUrl, {
        method: options.method ?? "GET",
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          ...(options.headers ?? {}),
        },
        signal: controller.signal,
      });
    } catch (err) {
      // The connect-time address check refused a private address.
      if (err instanceof InvalidUrlError) throw err;
      throw new UnreachableError(
        "We couldn't reach this site at all. Check the address, or the server may be down."
      );
    } finally {
      clearTimeout(timer);
    }

    hopMs = Date.now() - hopStarted;

    // Inspect and validate redirects manually to prevent SSRF hopping
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      if (options.followRedirects === false) {
        return {
          res,
          finalUrl: currentUrl,
          ttfbMs: hopMs,
        };
      }
      const loc = res.headers.get("location");
      if (!loc) {
        return {
          res,
          finalUrl: currentUrl,
          ttfbMs: hopMs,
        };
      }
      redirects++;
      if (redirects > maxRedirects) {
        throw new UnreachableError("The site redirected too many times.");
      }
      currentUrl = new URL(loc, currentUrl).toString();
      continue;
    }

    return {
      res,
      finalUrl: currentUrl,
      ttfbMs: hopMs,
    };
  }
}

async function quietFetch(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response | null> {
  try {
    const { res } = await safeFetch(url, {
      timeoutMs: init?.timeoutMs ?? 8000,
      headers: (init?.headers as Record<string, string>) ?? {},
      method: init?.method ?? "GET",
      followRedirects: init?.redirect !== "manual",
    });
    return res;
  } catch {
    return null;
  }
}

/** HEAD first; some servers reject HEAD (403/405/501), so retry with GET. */
async function urlExists(url: string): Promise<boolean> {
  let res = await quietFetch(url, { method: "HEAD" });
  if (!res || [403, 405, 501].includes(res.status)) {
    res = await quietFetch(url);
    void res?.body?.cancel().catch(() => {});
  }
  return Boolean(res && res.status < 400);
}

/** Follows http:// through any redirects; "insecure" only if it serves
 *  a page over plain http. Unreachable / blocked over http reports nothing. */
async function probeHttpUpgrade(
  host: string
): Promise<{ verdict: "secure" | "insecure" | null; status?: number }> {
  try {
    const { res, finalUrl } = await safeFetch(`http://${host}/`, {
      timeoutMs: 8000,
      maxRedirects: 4,
    });
    void res.body?.cancel().catch(() => {});
    if (finalUrl.startsWith("https://")) return { verdict: "secure" };
    return res.status < 400
      ? { verdict: "insecure", status: res.status }
      : { verdict: null };
  } catch {
    return { verdict: null };
  }
}

/** Single-line, length-capped excerpt for the evidence lines. */
function clip(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function fileName(src: string | undefined): string {
  if (!src) return "(no src)";
  const path = src.split(/[?#]/)[0];
  return clip(path.slice(path.lastIndexOf("/") + 1) || src, 60);
}

/** Attribute value test that works with or without quotes (minified HTML
 *  often writes name=viewport or rel=icon). `value` is a regex fragment. */
function attrIs(name: string, value: string, unquoted = value): string {
  return `${name}\\s*=\\s*(?:"(?:${value})"|'(?:${value})'|(?:${unquoted})(?=[\\s/>]))`;
}

/** First tag of `tag` whose `attr` matches `value` (regex fragment). An
 *  unquoted value can't contain spaces, so pass a space-free `unquoted`
 *  pattern when `value` could match across them. */
function findTag(
  html: string,
  tag: string,
  attr: string,
  value: string,
  unquoted = value
): string | undefined {
  return new RegExp(`<${tag}\\b[^>]*\\b${attrIs(attr, value, unquoted)}[^>]*>`, "i").exec(html)?.[0];
}

function match(html: string, re: RegExp): string | undefined {
  return re.exec(html)?.[1]?.trim();
}

/** Value of an attribute inside one tag; handles either quote style, so
 *  content="Joe's Pizza" isn't cut off at the apostrophe. */
function attrValue(tag: string, name: string): string | undefined {
  const m = new RegExp(
    `(?<![\\w-])${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i"
  ).exec(tag);
  return (m?.[1] ?? m?.[2] ?? m?.[3])?.trim();
}

function hasAttr(tag: string, name: string): boolean {
  return new RegExp(`(?<![\\w-])${name}(?:\\s*=|[\\s/>])`, "i").test(tag);
}

/** <link rel> values that make the browser actually load the resource. */
const LOADED_LINK_RELS = /\b(?:stylesheet|icon|preload|modulepreload|manifest)\b/i;

const ANALYTICS_RE = new RegExp(
  [
    "gtag\\(|gtag/js|google-analytics\\.com|googletagmanager\\.com|analytics\\.js",
    "\\bga\\(\\s*['\"]create|_gaq|dataLayer",
    "connect\\.facebook\\.net/[^\"']*/fbevents\\.js|fbq\\(",
    "plausible\\.io|usefathom\\.com|clarity\\.ms|hotjar\\.com|segment\\.(?:com|io)",
    "mixpanel\\.com|matomo|piwik|posthog|umami|simpleanalytics|pirsch\\.io",
    "cloudflareinsights\\.com|_vercel/insights|va\\.vercel-scripts\\.com|stats\\.wp\\.com",
    "statcounter|amplitude\\.com|fullstory\\.com|crazyegg\\.com|heapanalytics",
    "snap\\.licdn\\.com|hs-scripts\\.com|hs-analytics\\.net|googleadservices\\.com",
    "analytics\\.tiktok\\.com|ttq\\.load|static\\.ads-twitter\\.com",
  ].join("|"),
  "i"
);

const SOCIAL_PROOF_RE =
  /(?:testimonial|review|rating|stars?\b|trusted\s+by|our\s+clients|case\s+stud|accredit|certified|featured\s+in|trustpilot|yelp\.com|bbb\.org|birdeye|elfsight|homeadvisor|angi\.com|happy\s+customers)/i;

/** Visible-ish text: scripts, styles, noscript, comments and all tags removed. */
function plainText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ");
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’",
  ldquo: "“", rdquo: "”", copy: "©", reg: "®", trade: "™", bull: "•",
};

/** Decode HTML entities so lengths match what visitors and Google see
 *  ("Tom &amp; Jerry" is 11 characters, not 15). */
function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, dec, hex, name) => {
    if (dec || hex) {
      const code = dec ? parseInt(dec, 10) : parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[String(name).toLowerCase()] ?? m;
  });
}

// Formatted phone numbers, US/CA and the common international layouts:
//   (555) 123-4567 · +1 555 123 4567 · +44 20 7946 0958 · +91 98765 43210
//   0113 496 0000 · 020 7946 0958 · (02) 9876 5432 · 98765 43210
// Separators are required, so 10-digit IDs in URLs, timestamps and dates
// (12.03.2024, 2024-05-1234) never match.
const PHONE_RE = new RegExp(
  "(?<![\\d.-])(?:" +
    [
      String.raw`(?:\+?1[-.\s])?(?:\(\d{3}\)\s?|\d{3}[-.\s])\d{3}[-.\s]\d{4}`,
      String.raw`\+\d{1,3}[-.\s]?(?:\(\d{1,4}\))?\d{0,5}(?:[-.\s]\d{2,5}){1,4}`,
      String.raw`\(?0\d{1,4}\)?[-.\s]\d{3,4}[-.\s]\d{3,4}`,
      String.raw`[6-9]\d{4}[-.\s]\d{5}`,
    ]
      .map((p) => `(?:${p})`)
      .join("|") +
    ")(?!\\d)"
);

export function runHtmlAndHeaderChecks(params: {
  finalUrl: string;
  html: string;
  headers: Headers;
  ttfbMs: number;
}): {
  issues: RawIssue[];
  pageMeta: { title?: string; description?: string };
  viewportPass: boolean;
  htmlBytes: number;
} {
  const { finalUrl, html, headers, ttfbMs } = params;
  const issues: RawIssue[] = [];
  const isHttps = finalUrl.startsWith("https://");
  const htmlBytes = Buffer.byteLength(html);

  // ---- Security -----------------------------------------------------------

  if (isHttps) {
    // HSTS
    if (!headers.get("strict-transport-security")) {
      issues.push({
        id: "no-hsts",
        severity: "warning",
        finding: "the Strict-Transport-Security header is missing",
        evidence: ["Response header strict-transport-security: not present"],
      });
    }
  } else {
    issues.push({
      id: "no-https",
      severity: "critical",
      finding: "the site is served over plain http:// with no encryption",
      evidence: [`Final address: ${clip(finalUrl)}`],
    });
  }

  // X-Content-Type-Options
  if (
    (headers.get("x-content-type-options") ?? "").toLowerCase() !==
    "nosniff"
  ) {
    issues.push({
      id: "no-xcto",
      severity: "info",
      finding: "the X-Content-Type-Options header is missing",
      evidence: ["Response header x-content-type-options: not present"],
    });
  }

  // Charset declaration (the Content-Type header counts too)
  if (
    !/charset=/i.test(headers.get("content-type") ?? "") &&
    !/<meta\b[^>]*charset\s*=/i.test(html) &&
    !/<meta\b[^>]*content\s*=\s*["']?[^"'>]*charset=/i.test(html)
  ) {
    issues.push({
      id: "missing-charset",
      severity: "info",
      finding: "no character encoding (<meta charset>) is declared in the page head",
      evidence: ["No <meta charset> in the page and no charset in the Content-Type header"],
    });
  }

  // Server version disclosure
  const srv = headers.get("server") ?? "";
  const pby = headers.get("x-powered-by") ?? "";
  if (/\d+\.\d+/.test(srv) || /\d+\.\d+/.test(pby)) {
    issues.push({
      id: "server-leak",
      severity: "info",
      finding: `the server broadcasts backend software versions (${[srv, pby].filter(Boolean).join(", ")})`,
      evidence: [
        srv ? `server: ${clip(srv, 80)}` : "",
        pby ? `x-powered-by: ${clip(pby, 80)}` : "",
      ].filter(Boolean),
    });
  }

  // Referrer-Policy
  if (!headers.get("referrer-policy")) {
    issues.push({
      id: "no-referrer-policy",
      severity: "info",
      finding: "no Referrer-Policy header is set, risking query parameter leakage to external links",
      evidence: ["Response header referrer-policy: not present"],
    });
  }

  // Insecure cookies. Header.get() folds several Set-Cookie headers into one
  // string, so inspect each cookie separately. A missing Secure flag is the
  // real exposure; a missing SameSite is minor (browsers default to Lax).
  const rawCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie") ?? ""].filter(Boolean);
  const cookieName = (c: string) => clip(c.split("=")[0], 40);
  if (isHttps && rawCookies.some((c) => !/;\s*secure\b/i.test(c))) {
    issues.push({
      id: "insecure-cookies",
      severity: "warning",
      finding: "cookies are set without the Secure flag, so browsers may send them over unencrypted connections",
      evidence: rawCookies
        .filter((c) => !/;\s*secure\b/i.test(c))
        .slice(0, 3)
        .map((c) => `Cookie "${cookieName(c)}" has no Secure flag`),
    });
  } else if (rawCookies.some((c) => !/;\s*samesite\s*=/i.test(c))) {
    issues.push({
      id: "insecure-cookies",
      severity: "info",
      finding: "cookies are set without an explicit SameSite attribute",
      evidence: rawCookies
        .filter((c) => !/;\s*samesite\s*=/i.test(c))
        .slice(0, 3)
        .map((c) => `Cookie "${cookieName(c)}" has no SameSite attribute`),
    });
  }

  // Clickjacking protection — low risk for a brochure site, so info only
  const csp = headers.get("content-security-policy") ?? "";
  if (!headers.get("x-frame-options") && !csp.includes("frame-ancestors")) {
    issues.push({
      id: "no-frame-protection",
      severity: "info",
      finding:
        "neither X-Frame-Options nor a CSP frame-ancestors rule is set",
      evidence: [
        "Response header x-frame-options: not present",
        csp
          ? "content-security-policy is set but has no frame-ancestors rule"
          : "Response header content-security-policy: not present",
      ],
    });
  }

  // Mixed content: only resources the browser actually loads. Hints such as
  // <link rel="canonical|profile|image_src|alternate"> never cause warnings.
  if (isHttps) {
    const insecureAssets = (
      html.match(/<(?:img|script|link|iframe|video|audio|source)\b[^>]*>/gi) ?? []
    ).flatMap((tag) => {
      const isLink = /^<link\b/i.test(tag);
      const ref = attrValue(tag, isLink ? "href" : "src");
      if (!ref || !/^http:\/\//i.test(ref)) return [];
      if (isLink && !LOADED_LINK_RELS.test(attrValue(tag, "rel") ?? "")) return [];
      return [ref];
    });
    if (insecureAssets.length > 0) {
      issues.push({
        id: "mixed-content",
        severity: "warning",
        finding: "the page loads some assets over insecure http://",
        evidence: insecureAssets.slice(0, 3).map((u) => clip(u, 110)),
      });
    }
  }

  // ---- Performance --------------------------------------------------------

  // TTFB
  if (ttfbMs >= 1500) {
    issues.push({
      id: "slow-ttfb",
      severity: "warning",
      finding: `the server took ${(ttfbMs / 1000).toFixed(1)}s to start responding in our test (target: under 0.8s)`,
      evidence: [
        `Response headers arrived after ${Math.round(ttfbMs)} ms, measured from our server`,
        "A single measurement — retest before quoting it to a client",
      ],
    });
  }

  // HTML weight
  if (htmlBytes > 100 * 1024) {
    issues.push({
      id: "heavy-html",
      severity: "info",
      finding: `the page HTML alone is ${Math.round(htmlBytes / 1024)}KB (target: under 100KB)`,
      evidence: [`HTML document: ${Math.round(htmlBytes / 1024)} KB, uncompressed`],
    });
  }

  // Client-rendered SPA shell
  const bodyContent = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? "";
  const visibleText = bodyContent
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .trim();
  const scriptCount = (html.match(/<script[\s>]/gi) ?? []).length;
  if (visibleText.length < 80 && scriptCount >= 2 && !/<h1[\s>]/i.test(html)) {
    issues.push({
      id: "client-rendered-spa",
      severity: "warning",
      finding:
        "the initial HTML payload has almost no readable text and relies heavily on client-side JavaScript to render",
      evidence: [
        `Readable text in the initial HTML: ${visibleText.length} characters`,
        `<script> tags: ${scriptCount}`,
      ],
    });
  }

  // ---- SEO ----------------------------------------------------------------

  // Title
  const rawTitle = match(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = rawTitle === undefined ? undefined : decodeEntities(rawTitle).replace(/\s+/g, " ").trim();
  if (!title) {
    issues.push({
      id: "bad-title",
      severity: "critical",
      finding: "the page has no <title> tag at all",
      evidence: ["No <title> tag in the page"],
    });
  } else if (title.length < 15 || title.length > 60) {
    issues.push({
      id: "bad-title",
      severity: "warning",
      finding: `the page title is ${title.length} characters (ideal: 15–60)`,
      evidence: [`<title>${clip(title)}</title>`, `${title.length} characters`],
    });
  }

  // Meta description
  const metaDescTag = findTag(html, "meta", "name", "description");
  const metaDescRaw = metaDescTag ? attrValue(metaDescTag, "content") : undefined;
  const metaDesc = metaDescRaw === undefined ? undefined : decodeEntities(metaDescRaw).replace(/\s+/g, " ").trim();
  if (!metaDesc) {
    issues.push({
      id: "bad-meta-desc",
      severity: "warning",
      finding: "the page has no meta description",
      evidence: metaDescTag
        ? [clip(metaDescTag), "The content attribute is empty"]
        : ['No <meta name="description"> tag in the page'],
    });
  } else if (metaDesc.length < 50 || metaDesc.length > 160) {
    issues.push({
      id: "bad-meta-desc",
      severity: "warning",
      finding: `the meta description is ${metaDesc.length} characters (ideal: 50–160)`,
      evidence: [`content="${clip(metaDesc)}"`, `${metaDesc.length} characters`],
    });
  }

  // Canonical
  if (!findTag(html, "link", "rel", "canonical")) {
    issues.push({
      id: "no-canonical",
      severity: "info",
      finding: "no canonical URL tag is set",
      evidence: ['No <link rel="canonical"> in the page'],
    });
  }

  // Social cards
  const ogMissing = ["og:title", "og:description", "og:image"].filter(
    (p) => !findTag(html, "meta", "property", p)
  );
  if (ogMissing.length > 0) {
    issues.push({
      id: "no-og",
      severity: "warning",
      finding: `social sharing tags are incomplete (missing ${ogMissing.join(", ")})`,
      evidence: [`Missing: ${ogMissing.join(", ")}`],
    });
  }

  // Viewport & Mobile UI/UX
  const viewportTag =
    findTag(html, "meta", "name", "viewport") ?? "";
  const viewportPass = Boolean(viewportTag);
  if (!viewportPass) {
    issues.push({
      id: "no-viewport",
      severity: "critical",
      finding: "the page has no mobile viewport tag",
      evidence: ['No <meta name="viewport"> tag in the page'],
    });
  } else if (
    /user-scalable\s*=\s*(?:no|0|false)\b|maximum-scale\s*=\s*1(?:\.0)?(?:\D|$)/i.test(
      viewportTag
    )
  ) {
    issues.push({
      id: "disabled-pinch-zoom",
      severity: "warning",
      finding:
        "the viewport tag disables pinch-to-zoom (user-scalable=no or maximum-scale=1), breaking mobile accessibility",
      evidence: [clip(viewportTag)],
    });
  }

  // Tap-to-call mobile contact action
  const cleanBodyText = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
  const readableText = plainText(html);
  const phoneMatch = PHONE_RE.exec(readableText)?.[0];
  const hasPhoneInText = Boolean(phoneMatch);
  const hasTelLink = /<a\b[^>]*href\s*=\s*["']?(?:tel|callto):/i.test(html);
  if (hasPhoneInText && !hasTelLink) {
    issues.push({
      id: "missing-touch-cta",
      severity: "warning",
      finding: "phone numbers appear in text without a tap-to-call (tel:) link for smartphones",
      evidence: [
        `Phone number in the page text: ${phoneMatch}`,
        'No <a href="tel:…"> link anywhere in the page',
      ],
    });
  }

  // Legacy layout tables breaking mobile reflow
  const layoutTableTag =
    /<table\b[^>]*(?:cellpadding|cellspacing|width\s*=\s*["']?(?:[5-9]\d{2}|\d{4,})\b)[^>]*>/i.exec(
      html
    )?.[0];
  const hasLayoutTable = Boolean(layoutTableTag) && !/<th[\s>]/i.test(html);
  if (hasLayoutTable) {
    issues.push({
      id: "layout-tables",
      severity: "warning",
      finding:
        "the page uses legacy HTML table structures for visual layout instead of responsive CSS",
      evidence: [clip(layoutTableTag ?? "")],
    });
  }

  // H1 structure (markup inside <script>/<template> doesn't count). Google is
  // fine with several H1s, so that case is informational only.
  const markupOnly = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|template)\b[\s\S]*?<\/\1>/gi, "");
  const h1Texts = (markupOnly.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) ?? []).map((h) =>
    clip(decodeEntities(h.replace(/<[^>]+>/g, " ")), 80)
  );
  const h1Count = (markupOnly.match(/<h1[\s>]/gi) ?? []).length;
  if (h1Count === 0) {
    issues.push({
      id: "bad-h1",
      severity: "warning",
      finding: "the page has no H1 heading",
      evidence: ["No <h1> element in the page"],
    });
  } else if (h1Count > 1) {
    issues.push({
      id: "bad-h1",
      severity: "info",
      finding: `the page has ${h1Count} H1 headings (a single, clear H1 is the safer convention)`,
      evidence: h1Texts.slice(0, 3).map((t) => `<h1> ${t ? `"${t}"` : "(empty)"}`),
    });
  }

  // Image alt coverage (accessibility). alt="" is the correct markup for
  // decorative images, so only a missing alt attribute counts. Tracking
  // pixels and <noscript> fallbacks are ignored.
  const imgs = (
    markupOnly.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "").match(/<img\b[^>]*>/gi) ?? []
  ).filter(
    (t) =>
      !/(?<![\w-])(?:width|height)\s*=\s*["']?1["']?(?![\d%])/i.test(t)
  );
  if (imgs.length >= 3) {
    const withAlt = imgs.filter((t) => hasAttr(t, "alt")).length;
    if (withAlt / imgs.length < 0.8) {
      issues.push({
        id: "missing-alts",
        severity: "warning",
        finding: `${imgs.length - withAlt} of ${imgs.length} images are missing an alt attribute`,
        evidence: [
          `${imgs.length - withAlt} of ${imgs.length} <img> tags have no alt attribute, for example:`,
          ...imgs
            .filter((t) => !hasAttr(t, "alt"))
            .slice(0, 3)
            .map((t) => fileName(attrValue(t, "src"))),
        ],
      });
    }
  }

  // Language attribute
  if (!/<html\b[^>]*\blang\s*=\s*["']?[a-zA-Z]{2}/i.test(html)) {
    issues.push({
      id: "missing-lang",
      severity: "info",
      finding:
        "the <html> tag does not declare a language attribute (e.g. lang=\"en\")",
      evidence: ["<html> tag has no lang attribute"],
    });
  }

  // Form field accessibility & tap usability
  const inputs = markupOnly.match(/<input\b[^>]*>/gi) ?? [];
  // Honeypots and visually hidden file pickers (display:none, hidden,
  // aria-hidden) aren't something a visitor can label or use.
  const isHiddenInput = (tag: string) =>
    hasAttr(tag, "hidden") ||
    /aria-hidden\s*=\s*["']?true/i.test(tag) ||
    /style\s*=\s*["']?[^"'>]*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(tag);
  const interactiveInputs = inputs.filter(
    (tag) =>
      !/\btype\s*=\s*["']?(?:hidden|submit|button|reset|image)\b/i.test(tag) &&
      !isHiddenInput(tag)
  );
  if (interactiveInputs.length > 0) {
    // Inputs nested inside <label>…</label> are labelled without an id.
    const wrappedInLabel = new Set(
      (markupOnly.match(/<label\b[^>]*>[\s\S]*?<\/label>/gi) ?? []).flatMap(
        (l) => l.match(/<input\b[^>]*>/gi) ?? []
      )
    );
    const unlabeled = interactiveInputs.filter(
      (tag) =>
        !hasAttr(tag, "aria-label") &&
        !hasAttr(tag, "aria-labelledby") &&
        !hasAttr(tag, "title") &&
        !wrappedInLabel.has(tag) &&
        !attrValue(tag, "id")
    );
    if (unlabeled.length > 0) {
      issues.push({
        id: "unlabeled-form-inputs",
        severity: "warning",
        finding: `${unlabeled.length} interactive form field${
          unlabeled.length === 1 ? "" : "s"
        } lack an accessible label or aria-label`,
        evidence: unlabeled.slice(0, 3).map((t) => clip(t, 100)),
      });
    }
  }

  // Vague link text anchor UX. Anchor text is read with nested tags stripped,
  // so <a><span>Read More</span></a> and "Read more »" are caught too.
  const vagueLinks = (markupOnly.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []).filter((a) => {
    const label = decodeEntities(a.replace(/<[^>]+>/g, " "))
      .replace(/[»›>→…\s]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return /^(?:click here|read more|learn more|here|more)$/i.test(label);
  });
  if (vagueLinks.length >= 2) {
    issues.push({
      id: "vague-link-text",
      severity: "warning",
      finding: `${vagueLinks.length} links use non-descriptive anchor text ('click here', 'read more')`,
      evidence: vagueLinks.slice(0, 3).map((a) => {
        const label = clip(decodeEntities(a.replace(/<[^>]+>/g, " ")), 40);
        const href = attrValue(a, "href");
        return href ? `"${label}" → ${clip(href, 70)}` : `"${label}"`;
      }),
    });
  }

  // Semantic landmark structure
  const hasLandmarks = /<(?:main|nav|header|footer)\b/i.test(html);
  if (!hasLandmarks && html.length > 300) {
    issues.push({
      id: "missing-semantic-landmarks",
      severity: "info",
      finding:
        "the page does not use HTML5 semantic landmark elements (<main>, <nav>, <header>, <footer>)",
      evidence: ["No <main>, <nav>, <header> or <footer> element in the page"],
    });
  }

  // Search engine indexing directives (noindex)
  const metaRobots =
    findTag(html, "meta", "name", "robots") ?? "";
  const xRobots = headers.get("x-robots-tag") ?? "";
  if (/noindex/i.test(metaRobots) || /noindex/i.test(xRobots)) {
    issues.push({
      id: "noindex-tag",
      severity: "critical",
      finding:
        "the page contains a 'noindex' directive, instructing search engines to hide it completely",
      evidence: [/noindex/i.test(metaRobots) ? clip(metaRobots) : `x-robots-tag: ${clip(xRobots, 80)}`],
    });
  }

  // ---- Strategy, Conversion & Branding Checks ------------------------------

  // Analytics & Conversion Tracking
  const hasAnalytics = ANALYTICS_RE.test(html);
  if (!hasAnalytics && html.length > 500) {
    issues.push({
      id: "missing-analytics",
      severity: "warning",
      finding:
        "no conversion analytics or tracking tags (GA4, GTM, Meta Pixel) were detected",
      evidence: [
        "Searched the page source for Google Analytics / Tag Manager, Meta Pixel, Plausible, Fathom, Matomo, Hotjar, Clarity, Cloudflare Analytics and others: none found",
        "Tags added by a server-side container wouldn't be visible to us",
      ],
    });
  }

  // Primary Call-to-Action (CTA)
  const hasPrimaryCta =
    /<button\b/i.test(html) ||
    /<input\b[^>]*type\s*=\s*["']?(?:submit|button)/i.test(html) ||
    /<a\b[^>]*class\s*=\s*["']?[^"'>]*(?:btn|cta|button)/i.test(html) ||
    Boolean(findTag(html, "a", "role", "button")) ||
    hasTelLink ||
    /<form\b/i.test(html);
  if (!hasPrimaryCta && html.length > 400) {
    issues.push({
      id: "missing-primary-cta",
      severity: "warning",
      finding:
        "the page lacks a clear, prominent Call-to-Action (CTA) button or inquiry form",
      evidence: ["No <button>, <form>, button-styled link or tel: link in the page HTML"],
    });
  }

  // Social Proof & Trust Proof
  const hasSocialProof =
    SOCIAL_PROOF_RE.test(cleanBodyText) ||
    /"@type"\s*:\s*"(?:Review|AggregateRating)"/i.test(html);
  if (!hasSocialProof && cleanBodyText.length > 1200) {
    issues.push({
      id: "missing-social-proof",
      severity: "info",
      finding:
        "no customer testimonials, reviews, or third-party trust badges were found",
      evidence: [
        "No testimonial, review, rating or trust-badge wording in the page HTML",
        "Reviews loaded by scripts (for example an embedded Google reviews widget) wouldn't appear in the HTML we read",
      ],
    });
  }

  // Outdated copyright: use the newest year across every notice, and treat
  // "2010–2026" as 2026 (the end of a range is what visitors read).
  const currentYear = new Date().getFullYear();
  const copyrightNotices = [
    ...readableText.matchAll(
      /(?:copyright|©|&copy;|&#169;|\(c\))\s*((?:19|20)\d\d)(?:\s*[-–—]\s*((?:19|20)\d\d))?(?=([^.]{0,40}))/gi
    ),
  ].map((m) => ({ year: Number(m[2] ?? m[1]), text: `${m[0]}${m[3] ?? ""}` }));
  const newestNotice = copyrightNotices.reduce<
    { year: number; text: string } | undefined
  >((best, n) => (!best || n.year > best.year ? n : best), undefined);
  const newestCopyright = newestNotice?.year;
  if (newestCopyright !== undefined && newestCopyright <= currentYear - 2) {
    issues.push({
      id: "outdated-copyright",
      severity: "info",
      finding: `the footer copyright shows ${newestCopyright} (${currentYear - newestCopyright} years out of date)`,
      evidence: [`Page text: "${clip(newestNotice?.text ?? "", 90)}"`],
    });
  }

  // Apple touch icon (high-res iOS bookmarking)
  if (!findTag(html, "link", "rel", "apple-touch-icon(?:-precomposed)?")) {
    issues.push({
      id: "missing-apple-touch-icon",
      severity: "info",
      finding: "no Apple touch icon is declared for iOS and mobile bookmarks",
      evidence: ['No <link rel="apple-touch-icon"> in the page'],
    });
  }

  // Theme color (mobile browser bar tint)
  if (!findTag(html, "meta", "name", "theme-color")) {
    issues.push({
      id: "missing-theme-color",
      severity: "info",
      finding:
        "no theme-color meta tag is set for mobile browser chrome branding",
      evidence: ['No <meta name="theme-color"> in the page'],
    });
  }

  return {
    issues,
    pageMeta: { title, description: metaDesc },
    viewportPass,
    htmlBytes,
  };
}

export function isAllRobotsBlocked(robotsText: string): boolean {
  const lines = robotsText.split(/\r?\n/);
  let groupUas: string[] = [];
  let groupHasDirectives = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) {
      groupUas = [];
      groupHasDirectives = false;
      continue;
    }

    const uaMatch = /^user-agent:\s*(.+)$/i.exec(line);
    if (uaMatch) {
      if (groupHasDirectives) {
        groupUas = [];
        groupHasDirectives = false;
      }
      groupUas.push(uaMatch[1].trim().toLowerCase());
      continue;
    }

    groupHasDirectives = true;
    if (groupUas.includes("*")) {
      if (/^disallow:\s*\/\s*$/i.test(line)) {
        return true;
      }
    }
  }

  return false;
}

export async function runChecks(url: string): Promise<ChecksResult> {
  // Main fetch with strict hop-by-hop SSRF validation
  const { res, finalUrl, ttfbMs } = await safeFetch(url, { timeoutMs: 15_000 });
  if (res.status >= 400) {
    // 401/403/429 from a site that works in a browser means a firewall or bot
    // shield (Cloudflare, Sucuri…) is turning automated visitors away.
    const blocksBots = [401, 403, 429].includes(res.status);
    throw new UnreachableError(
      blocksBots
        ? `This site blocks automated visitors (HTTP ${res.status}), so it can't be audited from here. It may still load fine in a browser.`
        : `The site responded with an error (HTTP ${res.status}), so it couldn't be audited.`
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (
    contentType &&
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml")
  ) {
    throw new UnreachableError(
      `This address returned a ${contentType.split(";")[0]} file instead of a website.`
    );
  }

  const origin = new URL(finalUrl).origin;
  const isHttps = finalUrl.startsWith("https://");
  let html: string;
  try {
    html = await res.text();
  } catch (err) {
    throw new UnreachableError(
      err instanceof BodyTooLargeError || (err as Error)?.cause instanceof BodyTooLargeError
        ? "That page is too large to audit."
        : "The site stopped responding before the page finished loading."
    );
  }

  // Run pure HTML and header inspection checks
  const { issues, pageMeta, viewportPass, htmlBytes } = runHtmlAndHeaderChecks({
    finalUrl,
    html,
    headers: res.headers,
    ttfbMs,
  });

  // ---- Network & Secondary Checks -----------------------------------------

  const hasIconLink = Boolean(
    findTag(html, "link", "rel", "[^\"'>]*\\bicon\\b[^\"'>]*", "[\\w-]*icon")
  );

  // The four probes are independent — run them together so a slow site can't
  // stack their timeouts past the function limit.
  const [httpProbe, hasFaviconFile, robotsRes] = await Promise.all([
    isHttps
      ? probeHttpUpgrade(new URL(finalUrl).host)
      : Promise.resolve({ verdict: null as "secure" | "insecure" | null, status: undefined }),
    hasIconLink ? Promise.resolve(true) : urlExists(`${origin}/favicon.ico`),
    quietFetch(`${origin}/robots.txt`),
  ]);

  // HTTPS enforced: http:// must end up on https:// (extra hops like
  // http://example.com → http://www.example.com → https://… are fine).
  if (httpProbe.verdict === "insecure") {
    issues.push({
      id: "no-https",
      severity: "critical",
      finding:
        "the insecure http:// version of the site loads without redirecting to https://",
      evidence: [
        `http://${new URL(finalUrl).host}/ answered ${httpProbe.status} and stayed on http:// (no redirect to https)`,
      ],
    });
  }

  if (!hasFaviconFile) {
    issues.push({
      id: "no-favicon",
      severity: "info",
      finding: "no favicon was found",
      evidence: ['No <link rel="icon"> in the page and /favicon.ico returned an error'],
    });
  }

  let robotsText = "";
  if (robotsRes && robotsRes.status === 200) {
    robotsText = await robotsRes.text();
    if (isAllRobotsBlocked(robotsText)) {
      issues.push({
        id: "robots-blocking",
        severity: "critical",
        finding: "robots.txt is blocking ALL search engines from the entire site",
        evidence: ["robots.txt has a group for User-agent: * containing Disallow: /"],
      });
    }
  } else {
    issues.push({
      id: "robots-missing",
      severity: "info",
      finding: "no robots.txt file was found",
      evidence: [
        `${origin}/robots.txt ${robotsRes ? `returned HTTP ${robotsRes.status}` : "did not respond"}`,
      ],
    });
  }

  if (!/sitemap:/i.test(robotsText)) {
    // Common locations: sitemap.xml, Yoast/Rank Math sitemap_index.xml, WordPress core wp-sitemap.xml
    const found = await Promise.all(
      ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"].map((path) =>
        urlExists(`${origin}${path}`)
      )
    );
    if (!found.some(Boolean)) {
      issues.push({
        id: "no-sitemap",
        severity: "info",
        finding:
          "no sitemap was found at the usual locations (and none is declared in robots.txt)",
        evidence: [
          "Checked /sitemap.xml, /sitemap_index.xml and /wp-sitemap.xml, and looked for a Sitemap: line in robots.txt",
        ],
      });
    }
  }

  return {
    finalUrl,
    ttfbMs,
    htmlBytes,
    viewportPass,
    pageMeta,
    issues,
  };
}
