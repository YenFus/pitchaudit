// What each finding means for the business, and what fixing it involves.
//
// Voice rules (so the report reads like an assessment, not a sales pitch):
//  - Say what is affected and roughly how much it matters. Small things are
//    called small.
//  - Never state a consequence as certain when it is conditional.
//  - No invented statistics. The one figure quoted (slow-ttfb) is Google's.
//  - `pitch` is the sentence a freelancer can drop into an email. It only
//    claims what the evidence on the page supports.

import type { CategoryId } from "../types";
import type { RawIssue } from "./checks";

export interface IssueCopy {
  category: CategoryId;
  title: string;
  impact: string;
  fix: string;
  /** One plain sentence for a cold email. Omitted for findings that are
   *  real but not worth leading an email with. */
  pitch?: (raw: RawIssue) => string;
}

const num = (text: string, re: RegExp): number | undefined => {
  const m = re.exec(text);
  return m ? Number(m[1]) : undefined;
};

export const IMPACT_COPY: Record<string, IssueCopy> = {
  // ---- Security -----------------------------------------------------------
  "no-https": {
    category: "security",
    title: "Site can be opened without encryption",
    impact:
      "Browsers label unencrypted pages “Not secure” in the address bar, which makes visitors wary of entering any details. Google also treats https as a (small) ranking signal.",
    fix: "Redirect every http:// address to https:// permanently. Most hosts offer this as a setting, and certificates are free.",
    pitch: (raw) =>
      /plain http/.test(raw.finding)
        ? "The site is served over http rather than https, so browsers may label it “Not secure” when people open it."
        : "Typing the address without https loads an unencrypted copy of the site instead of redirecting to the secure one.",
  },
  "no-hsts": {
    category: "security",
    title: "No HSTS header",
    impact:
      "Without it, a visitor's first connection can be downgraded to an unencrypted one on an untrusted network such as public Wi-Fi. It's a hardening step, not a visible fault.",
    fix: "Send a Strict-Transport-Security header once https is working everywhere. One line of server configuration.",
  },
  "no-xcto": {
    category: "security",
    title: "Missing content-type protection",
    impact:
      "Browsers are allowed to guess what type a file is instead of trusting the server. Minor hardening; it matters most on sites that accept uploads.",
    fix: "Send the header “X-Content-Type-Options: nosniff”. One line, no side effects.",
  },
  "no-frame-protection": {
    category: "security",
    title: "Site can be embedded inside other websites",
    impact:
      "Another site could display this one in a hidden frame to trick visitors into clicking things (“clickjacking”). Low risk for a brochure site with no logins, but blocking it is standard practice.",
    fix: "Send an X-Frame-Options header, or a Content-Security-Policy with frame-ancestors, naming who may embed the pages.",
  },
  "mixed-content": {
    category: "security",
    title: "Insecure content on a secure page",
    impact:
      "Some images or scripts load over plain http on an https page. Browsers may block them or show a warning, which can leave gaps or broken pieces on the page.",
    fix: "Change those http:// links to https:// (or relative links). Often a find-and-replace in the CMS.",
    pitch: () =>
      "Some images or scripts on the homepage load over plain http on a secure page, which browsers can block or flag.",
  },
  "missing-charset": {
    category: "accessibility",
    title: "No character encoding declared",
    impact:
      "Without a declared encoding the browser has to guess how to read the text, which can turn apostrophes and accents into garbage characters.",
    fix: "Add <meta charset=\"utf-8\"> at the top of the <head>, or send the charset in the Content-Type header.",
  },
  "server-leak": {
    category: "security",
    title: "Server announces its software versions",
    impact:
      "The response headers reveal exact software versions. That doesn't cause a problem by itself, but it saves an attacker a step if any of that software is out of date.",
    fix: "Turn off version reporting (for example ServerTokens Prod in Apache, expose_php = Off in PHP).",
  },
  "no-referrer-policy": {
    category: "security",
    title: "No referrer policy",
    impact:
      "When someone clicks a link off the site, their browser may pass along the full address of the page they were on. Minor privacy hardening.",
    fix: "Send the header “Referrer-Policy: strict-origin-when-cross-origin”.",
  },
  "insecure-cookies": {
    category: "security",
    title: "Cookies set without protective flags",
    impact:
      "A cookie without the Secure flag can be sent over an unencrypted connection; one without SameSite gets browser-default handling. Matters most for logins and shopping carts.",
    fix: "Add Secure, HttpOnly and SameSite=Lax to session and login cookies.",
  },

  // ---- Performance --------------------------------------------------------
  "slow-ttfb": {
    category: "performance",
    title: "Slow server response",
    impact:
      "Nothing can appear until the server answers. Google's research found the chance a visitor leaves is 32% higher when a page takes 3 seconds to load instead of 1, so a slow start costs visits. This was one measurement from our server, so retest before quoting it.",
    fix: "Turn on page caching (most CMS platforms have a plugin) or move off overloaded budget hosting. Often a same-day fix.",
    pitch: (raw) => {
      const s = num(raw.finding, /took ([\d.]+)s/);
      return s
        ? `The server took about ${s} seconds to start responding in my check, which is slow.`
        : "The server is slow to start responding in my check.";
    },
  },
  "heavy-html": {
    category: "performance",
    title: "Very large page HTML",
    impact:
      "The page's own code is big before any image loads. That adds to load time, most noticeably on phones with a weak connection.",
    fix: "Enable server compression and clear out unused page-builder markup.",
    pitch: (raw) => {
      const kb = num(raw.finding, /is (\d+)KB/);
      return kb
        ? `The homepage's HTML alone is ${kb} KB, which is heavy before a single image loads.`
        : "The homepage's HTML is unusually large.";
    },
  },
  "client-rendered-spa": {
    category: "performance",
    title: "Page arrives almost empty",
    impact:
      "The server sends a nearly empty page and JavaScript builds the content in the browser. Visitors on slow connections wait on a blank screen, and some search crawlers may see little to index.",
    fix: "Render the content on the server (SSR) or pre-build it (static generation) so the first response contains the text.",
    pitch: () =>
      "The homepage arrives almost empty and relies on JavaScript to show anything, so visitors on a slow connection (and some search crawlers) may see a blank page.",
  },

  // ---- SEO ----------------------------------------------------------------
  "bad-title": {
    category: "seo",
    title: "Page title problem",
    impact:
      "The title is the headline shown in Google results. Google usually cuts titles off after about 60 characters, and when a title is missing or very short it writes its own.",
    fix: "Write a 15–60 character title that says what the business does and where, e.g. “Bright Smile Dental — Family Dentist in Austin”.",
    pitch: (raw) => {
      const n = num(raw.finding, /is (\d+) characters/);
      if (n === undefined)
        return "The homepage has no title tag, so Google has to make up the headline it shows in search results.";
      return n > 60
        ? `The homepage title is ${n} characters, which is long enough that Google will cut it off in search results.`
        : `The homepage title is only ${n} characters, so it says very little about the business in search results.`;
    },
  },
  "bad-meta-desc": {
    category: "seo",
    title: "Meta description problem",
    impact:
      "This is the short text under the headline in Google results. It doesn't affect ranking directly, but a missing or badly sized one leaves Google to pick a random snippet of page text.",
    fix: "Write a 50–160 character summary of the business as the meta description.",
    pitch: (raw) => {
      const n = num(raw.finding, /is (\d+) characters/);
      if (n === undefined)
        return "The homepage has no meta description, so Google picks a random snippet of page text for the search listing.";
      return n > 160
        ? `The meta description is ${n} characters, so Google will truncate it in search results.`
        : `The meta description is only ${n} characters, which gives people little reason to click.`;
    },
  },
  "no-canonical": {
    category: "seo",
    title: "No canonical URL tag",
    impact:
      "If the same page can be reached at several addresses (with and without www, or with tracking parameters), Google has to guess which one to list. A single-address site is unlikely to be affected.",
    fix: "Add a canonical tag naming the preferred address of each page. SEO plugins usually do this for you.",
  },
  "bad-h1": {
    category: "seo",
    title: "Heading structure problem",
    impact:
      "The main heading (H1) helps search engines and screen readers understand what the page is about. A page with none loses that signal; several H1s are generally tolerated.",
    fix: "Give the page one H1 that states its topic plainly, with H2s for the subsections.",
    pitch: (raw) =>
      /no H1/.test(raw.finding)
        ? "The homepage has no main heading (H1), which search engines and screen readers use to understand what the page is about."
        : "",
  },
  "robots-blocking": {
    category: "seo",
    title: "Search engines are told to ignore the whole site",
    impact:
      "robots.txt asks every search engine not to crawl any page. Unless that's deliberate (a site still being built), the business won't show up in search results.",
    fix: "Remove the “Disallow: /” rule for User-agent: * from robots.txt. It takes a couple of minutes.",
    pitch: () =>
      "The site's robots.txt asks all search engines to stay away from the whole site, so it may not be showing up in search results at all.",
  },
  "robots-missing": {
    category: "seo",
    title: "No robots.txt file",
    impact:
      "Not a fault in itself. Search engines will crawl without guidance, and there's nowhere to point them to a sitemap.",
    fix: "Add a basic robots.txt that allows crawling and names the sitemap.",
  },
  "no-sitemap": {
    category: "seo",
    title: "No sitemap",
    impact:
      "A sitemap helps Google find every page and notice new ones sooner. Small sites with good internal links are usually found anyway, so this is a modest gain.",
    fix: "Generate a sitemap.xml (most CMS platforms have a plugin or built-in) and list it in robots.txt.",
    pitch: () =>
      "There's no sitemap, which makes it slower for Google to discover new pages on the site.",
  },
  "noindex-tag": {
    category: "seo",
    title: "Page tells search engines not to list it",
    impact:
      "A noindex instruction asks Google and Bing to leave this page out of results. If it's unintended (often left over from a staging site), the page can't be found through search.",
    fix: "Remove the noindex meta tag or X-Robots-Tag header once the site is meant to be public.",
    pitch: () =>
      "A tag on the homepage tells Google not to list the page in search results, which is usually a leftover from when the site was being built.",
  },

  // ---- Mobile -------------------------------------------------------------
  "no-viewport": {
    category: "mobile",
    title: "Not set up for phones",
    impact:
      "Without a viewport tag, phones show a zoomed-out copy of the desktop layout that visitors must pinch and zoom to read. Most web traffic now comes from phones, and Google judges the mobile version of a page.",
    fix: "Add the viewport meta tag and a responsive layout. The basics are an afternoon's work for a developer.",
    pitch: () =>
      "The site isn't set up for phones, so anyone opening it on a phone gets a shrunken desktop layout.",
  },
  "disabled-pinch-zoom": {
    category: "mobile",
    title: "Pinch-to-zoom is switched off",
    impact:
      "The viewport tag stops visitors zooming in. That makes small text hard to read, especially for people with poor eyesight, and it fails a basic accessibility guideline (WCAG 1.4.4).",
    fix: "Remove user-scalable=no and maximum-scale=1 from the viewport tag.",
    pitch: () =>
      "The site stops people pinch-zooming on their phone, which makes small text hard to read.",
  },
  "missing-touch-cta": {
    category: "mobile",
    title: "Phone number isn't tap-to-call",
    impact:
      "On a phone, a number that isn't a link has to be copied and pasted into the dialler. That's small friction, but it sits right at the moment someone is deciding to call.",
    fix: "Wrap phone numbers in <a href=\"tel:+1…\"> links so one tap dials.",
    pitch: (raw) => {
      const phone = /: (.+)$/.exec(raw.evidence?.[0] ?? "")?.[1];
      return phone
        ? `The phone number ${phone} isn't a tap-to-call link, so someone on a phone has to copy it by hand.`
        : "The phone number isn't a tap-to-call link, so someone on a phone has to copy it by hand.";
    },
  },
  "layout-tables": {
    category: "mobile",
    title: "Layout built with old-style tables",
    impact:
      "Tables used for page layout have fixed widths that don't reflow, so on a phone the page tends to scroll sideways or break.",
    fix: "Rebuild the layout with modern CSS (flexbox or grid) so it adapts to screen width.",
    pitch: () =>
      "The page layout is built with old-style tables, which tend to break on phones.",
  },

  // ---- Accessibility ------------------------------------------------------
  "missing-alts": {
    category: "accessibility",
    title: "Images without alt text",
    impact:
      "Screen-reader users hear nothing where these images are, and Google has less to go on for image search. Decorative images are fine with empty alt text; meaningful ones need a description.",
    fix: "Give each meaningful image a short description as alt text. Roughly an hour on a typical site.",
    pitch: (raw) => {
      const m = /(\d+) of (\d+) images/.exec(raw.finding);
      return m
        ? `${m[1]} of ${m[2]} images on the homepage have no alt text, so screen readers and Google can't tell what they show.`
        : "Several images on the homepage have no alt text, so screen readers and Google can't tell what they show.";
    },
  },
  "missing-lang": {
    category: "accessibility",
    title: "No page language declared",
    impact:
      "Screen readers use the language attribute to pick the right pronunciation, and browsers use it to offer translation.",
    fix: "Add lang=\"en\" (or the right code) to the <html> tag.",
  },
  "unlabeled-form-inputs": {
    category: "accessibility",
    title: "Form fields without labels",
    impact:
      "Fields with only placeholder text are hard to use with a screen reader, and browsers' autofill works less reliably. The placeholder also disappears as soon as someone starts typing.",
    fix: "Give each field a <label for=…> or an aria-label.",
    pitch: () =>
      "The form fields have no proper labels (only placeholder text), which makes the form harder to use with a screen reader or autofill.",
  },
  "vague-link-text": {
    category: "accessibility",
    title: "Links that just say “read more”",
    impact:
      "Links like “click here” tell neither visitors scanning the page nor Google's crawler where they lead.",
    fix: "Use descriptive link text, such as “See our drain-cleaning services”.",
    pitch: (raw) => {
      const n = num(raw.finding, /^(\d+) links/);
      return n
        ? `${n} links just say “read more” or “click here”, which tells neither visitors nor Google where they lead.`
        : "Several links just say “read more” or “click here”, which tells neither visitors nor Google where they lead.";
    },
  },
  "missing-semantic-landmarks": {
    category: "accessibility",
    title: "No page landmarks",
    impact:
      "Without <main>, <nav> and similar elements, screen-reader users can't jump between sections, and reader modes have a harder time finding the content.",
    fix: "Wrap the navigation in <nav>, the main content in <main>, and the footer in <footer>.",
  },

  // ---- Strategy & conversion ---------------------------------------------
  "no-og": {
    category: "strategy",
    title: "No social sharing preview",
    impact:
      "When someone shares a link on WhatsApp, Facebook or LinkedIn, these tags decide the title, description and picture shown. Without them the preview is bare or a random image.",
    fix: "Add Open Graph tags: title, description and a 1200×630 image.",
    pitch: (raw) => {
      const missing = raw.evidence?.[0] ?? "";
      return /^Missing: og:image$/.test(missing)
        ? "Links to the site shared on WhatsApp, Facebook or LinkedIn show up without a preview picture."
        : "Links to the site shared on WhatsApp, Facebook or LinkedIn show up without a proper title or picture.";
    },
  },
  "no-favicon": {
    category: "strategy",
    title: "No favicon",
    impact:
      "Browser tabs and bookmarks show a blank icon. Cosmetic, but it's a small sign of a site that hasn't been finished.",
    fix: "Export the logo as a small square icon and add it to the site.",
    pitch: () =>
      "The site has no favicon, so browser tabs and bookmarks show a blank icon.",
  },
  "missing-analytics": {
    category: "strategy",
    title: "No analytics found",
    impact:
      "We found no tracking code for Google Analytics, Tag Manager, Meta Pixel or similar. Without it there's usually no way to see how many people visit or which ones enquire. Server-side tracking wouldn't be visible to us.",
    fix: "Install Google Analytics 4 or a privacy-friendly alternative and set up a goal for enquiries.",
    pitch: () =>
      "I couldn't find any analytics tracking code on the homepage, so there's probably no way to see how many visitors turn into enquiries.",
  },
  "missing-primary-cta": {
    category: "strategy",
    title: "No obvious next step on the page",
    impact:
      "The homepage HTML has no button, form or tel: link telling visitors how to get in touch or book.",
    fix: "Add one clear action above the fold, such as “Get a free quote”, and repeat it lower down.",
    pitch: () =>
      "There's no obvious button or form on the homepage telling visitors how to get in touch or book.",
  },
  "missing-social-proof": {
    category: "strategy",
    title: "No reviews or testimonials on the page",
    impact:
      "Many people look for reviews or testimonials before contacting a business. We found none in the page text; reviews loaded by a script (for example an embedded Google widget) wouldn't appear to us.",
    fix: "Add two or three genuine testimonials with names, and show review stars near the contact button.",
    pitch: () =>
      "I didn't see any reviews or testimonials on the homepage, which many people look for before they get in touch.",
  },
  "outdated-copyright": {
    category: "strategy",
    title: "Copyright year is out of date",
    impact:
      "A footer year from a few years back can make a site look unmaintained, which visitors may read as a sign the business itself has slowed down.",
    fix: "Update the year, or have the footer show the current year automatically.",
    pitch: (raw) => {
      const y = num(raw.finding, /shows (\d{4})/);
      return y
        ? `The footer still says © ${y}, which can make a site look like it isn't being looked after.`
        : "The footer copyright year is out of date, which can make a site look like it isn't being looked after.";
    },
  },
  "missing-apple-touch-icon": {
    category: "strategy",
    title: "No home-screen icon for iPhones",
    impact:
      "When an iPhone user saves the site to their home screen, iOS uses a screenshot instead of a proper icon. Purely cosmetic.",
    fix: "Add a 180×180 PNG and reference it with <link rel=\"apple-touch-icon\">.",
  },
  "missing-theme-color": {
    category: "strategy",
    title: "No browser theme colour",
    impact:
      "Mobile browsers colour the address bar in a default grey instead of the brand colour. Purely cosmetic.",
    fix: "Add <meta name=\"theme-color\" content=\"#yourcolour\"> to the <head>.",
  },

  // ---- Lighthouse opportunities -------------------------------------------
  "render-blocking-resources": {
    category: "performance",
    title: "Scripts and styles hold up the first paint",
    impact:
      "The browser waits for these files before it shows anything, so visitors see a blank page for longer than needed.",
    fix: "Defer scripts that aren't needed immediately and inline the small amount of CSS the first screen uses.",
  },
  "uses-responsive-images": {
    category: "performance",
    title: "Oversized images sent to phones",
    impact:
      "Phones download desktop-sized images and shrink them, using data and adding load time on every page.",
    fix: "Serve each device an appropriately sized image (srcset). Most CMS image plugins can do this.",
  },
  "uses-optimized-images": {
    category: "performance",
    title: "Images that aren't compressed",
    impact:
      "The images are larger files than they need to be, which is often the biggest single contributor to a slow page.",
    fix: "Compress the existing images and turn on automatic compression for new uploads.",
  },
  "modern-image-formats": {
    category: "performance",
    title: "Older image formats",
    impact:
      "Formats like WebP and AVIF are usually noticeably smaller than JPEG or PNG at the same quality (Lighthouse estimates the saving below).",
    fix: "Convert images to WebP or AVIF. Many hosts and plugins can do this automatically.",
  },
  "offscreen-images": {
    category: "performance",
    title: "Images load before they're needed",
    impact:
      "Every image downloads immediately, including ones far down the page, which delays the content visitors came for.",
    fix: "Turn on lazy loading. Often a one-attribute change.",
  },
  "unused-javascript": {
    category: "performance",
    title: "JavaScript the page doesn't use",
    impact:
      "Visitors download and process code that never runs on this page. It's a cost on every visit, worst on phones.",
    fix: "Remove unused plugins and scripts, and load the rest only where they're needed.",
  },
  "unminified-javascript": {
    category: "performance",
    title: "Unminified JavaScript",
    impact: "The scripts are sent with all their whitespace and comments, so they're bigger than they need to be.",
    fix: "Enable minification in the build tool or caching plugin. Usually a checkbox.",
  },
  "unminified-css": {
    category: "performance",
    title: "Unminified CSS",
    impact: "The stylesheets are larger than necessary, which slightly slows the first paint.",
    fix: "Enable CSS minification, usually next to the script setting.",
  },
  "uses-text-compression": {
    category: "performance",
    title: "Text isn't compressed",
    impact:
      "The server sends HTML, CSS and JavaScript uncompressed, so every page transfer is bigger than it needs to be.",
    fix: "Enable gzip or Brotli compression on the server. One setting.",
  },
  "server-response-time": {
    category: "performance",
    title: "Slow server response",
    impact:
      "Every page starts late because the server is slow to answer, which other speed fixes can't make up for.",
    fix: "Add server-side caching or move off an overloaded host.",
  },
  redirects: {
    category: "performance",
    title: "Redirect chain before the page loads",
    impact:
      "Visitors are sent through more than one address before reaching the page, adding delay before loading even starts.",
    fix: "Link and redirect straight to the final address.",
  },
  "uses-long-cache-ttl": {
    category: "performance",
    title: "Files aren't cached for return visits",
    impact:
      "Returning visitors re-download images, styles and scripts instead of reusing what their browser already has.",
    fix: "Set long cache lifetimes on static files. A few lines of server configuration.",
  },
  "prioritize-lcp-image": {
    category: "performance",
    title: "Main image is discovered late",
    impact:
      "The largest image on screen is found late by the browser, so the page looks unfinished for the first moments.",
    fix: "Preload the main image and don't lazy-load it.",
  },
  "largest-contentful-paint-element": {
    category: "performance",
    title: "Main content appears slowly",
    impact:
      "The biggest element on the first screen takes a while to appear. Google counts this (Largest Contentful Paint) in its Core Web Vitals.",
    fix: "Compress and preload that element, and remove anything blocking it.",
  },
  "cumulative-layout-shift": {
    category: "performance",
    title: "Page jumps around while loading",
    impact:
      "Content moves as the page loads, so people misclick and lose their place. Google counts this (Cumulative Layout Shift) in its Core Web Vitals.",
    fix: "Declare width and height for images and embeds so space is reserved before they load.",
  },
};

/** Fallback for Lighthouse audits without handwritten copy. */
export function psiFallbackCopy(title: string, description: string): IssueCopy {
  return {
    category: "performance",
    title,
    impact:
      "Google's Lighthouse flagged this as slowing the page down for real visitors; the estimated saving is shown below.",
    fix:
      description.replace(/\[Learn[^\]]*\]\([^)]*\)\.?/g, "").trim() ||
      "A web developer can resolve this as part of a standard performance pass.",
  };
}
