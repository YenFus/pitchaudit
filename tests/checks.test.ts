import { describe, it, expect } from "vitest";
import { runHtmlAndHeaderChecks } from "@/lib/audit/checks";

describe("runHtmlAndHeaderChecks", () => {
  it("detects noindex directive in meta tag", () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Test Page with Great Title Length</title>
          <meta name="description" content="This is an awesome description that meets all the criteria for ideal length.">
          <meta name="robots" content="noindex, nofollow">
          <link rel="canonical" href="https://example.com">
          <meta property="og:title" content="Test Page">
          <meta property="og:description" content="Test Description">
          <meta property="og:image" content="https://example.com/og.png">
        </head>
        <body>
          <h1>Main Heading</h1>
          <p>This is a solid paragraph with lots of content to ensure it does not look like a blank SPA.</p>
        </body>
      </html>
    `;
    const headers = new Headers({
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-frame-options": "DENY",
    });

    const result = runHtmlAndHeaderChecks({
      finalUrl: "https://example.com",
      html,
      headers,
      ttfbMs: 150,
    });

    const noindexIssue = result.issues.find((i) => i.id === "noindex-tag");
    expect(noindexIssue).toBeDefined();
    expect(noindexIssue?.severity).toBe("critical");
  });

  it("detects noindex directive in X-Robots-Tag header", () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Test Page with Great Title Length</title>
          <meta name="description" content="This is an awesome description that meets all the criteria for ideal length.">
          <link rel="canonical" href="https://example.com">
          <meta property="og:title" content="Test Page">
          <meta property="og:description" content="Test Description">
          <meta property="og:image" content="https://example.com/og.png">
        </head>
        <body>
          <h1>Main Heading</h1>
          <p>Real content here for search engines.</p>
        </body>
      </html>
    `;
    const headers = new Headers({
      "x-robots-tag": "noindex",
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    });

    const result = runHtmlAndHeaderChecks({
      finalUrl: "https://example.com",
      html,
      headers,
      ttfbMs: 150,
    });

    const noindexIssue = result.issues.find((i) => i.id === "noindex-tag");
    expect(noindexIssue).toBeDefined();
  });

  it("detects missing charset and missing lang attribute", () => {
    const html = `
      <html>
        <head>
          <title>Test Page with Great Title Length</title>
        </head>
        <body><h1>Heading</h1></body>
      </html>
    `;
    const headers = new Headers();

    const result = runHtmlAndHeaderChecks({
      finalUrl: "https://example.com",
      html,
      headers,
      ttfbMs: 200,
    });

    expect(result.issues.some((i) => i.id === "missing-charset")).toBe(true);
    expect(result.issues.some((i) => i.id === "missing-lang")).toBe(true);
  });

  it("detects server software version leaks and missing referrer policy", () => {
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head><body><h1>Test</h1></body></html>`;
    const headers = new Headers({
      server: "Apache/2.4.52 (Ubuntu)",
      "x-powered-by": "PHP/8.1.2",
    });

    const result = runHtmlAndHeaderChecks({
      finalUrl: "https://example.com",
      html,
      headers,
      ttfbMs: 200,
    });

    const leak = result.issues.find((i) => i.id === "server-leak");
    expect(leak).toBeDefined();
    expect(leak?.finding).toContain("Apache/2.4.52");

    expect(result.issues.some((i) => i.id === "no-referrer-policy")).toBe(true);
  });

  it("detects insecure cookies lacking Secure or SameSite", () => {
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head><body><h1>Test</h1></body></html>`;
    const headers = new Headers({
      "set-cookie": "session_id=12345; Path=/",
    });

    const result = runHtmlAndHeaderChecks({
      finalUrl: "https://example.com",
      html,
      headers,
      ttfbMs: 200,
    });

    const cookieIssue = result.issues.find((i) => i.id === "insecure-cookies");
    expect(cookieIssue).toBeDefined();
    expect(cookieIssue?.severity).toBe("warning");
  });

  it("detects client-rendered SPA shells with empty DOM", () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>React App Single Page Application</title>
        </head>
        <body>
          <div id="root"></div>
          <script src="/static/js/main.chunk.js"></script>
          <script src="/static/js/bundle.js"></script>
        </body>
      </html>
    `;
    const headers = new Headers();

    const result = runHtmlAndHeaderChecks({
      finalUrl: "https://example.com",
      html,
      headers,
      ttfbMs: 200,
    });

    const spaIssue = result.issues.find((i) => i.id === "client-rendered-spa");
    expect(spaIssue).toBeDefined();
    expect(spaIssue?.severity).toBe("warning");
  });

  it("detects mobile and accessibility UI/UX defects", () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
          <title>Test Page for UI UX Flaws</title>
        </head>
        <body>
          <table width="750" cellpadding="5">
            <tr><td><h1>Contact Us</h1></td></tr>
            <tr><td>Call us today at 555-123-4567 for a quote!</td></tr>
            <tr>
              <td>
                <form>
                  <input type="text" name="username">
                  <input type="email" name="useremail">
                </form>
              </td>
            </tr>
            <tr>
              <td>
                <a href="/pricing">click here</a>
                <a href="/about">read more</a>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
    const headers = new Headers();

    const result = runHtmlAndHeaderChecks({
      finalUrl: "https://example.com",
      html,
      headers,
      ttfbMs: 200,
    });

    expect(result.issues.some((i) => i.id === "disabled-pinch-zoom")).toBe(true);
    expect(result.issues.some((i) => i.id === "missing-touch-cta")).toBe(true);
    expect(result.issues.some((i) => i.id === "layout-tables")).toBe(true);
    expect(result.issues.some((i) => i.id === "unlabeled-form-inputs")).toBe(true);
    expect(result.issues.some((i) => i.id === "vague-link-text")).toBe(true);
    expect(result.issues.some((i) => i.id === "missing-semantic-landmarks")).toBe(true);
  });

  it("passes cleanly on modern, well-configured HTML with proper security headers and UI/UX landmarks", () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Fast, Secure Modern Website Experience</title>
          <meta name="description" content="Discover our ultra-fast and secure web application built with modern performance standards.">
          <link rel="canonical" href="https://example.com">
          <link rel="icon" href="/favicon.ico">
          <link rel="apple-touch-icon" href="/apple-touch-icon.png">
          <meta name="theme-color" content="#3b82f6">
          <meta property="og:title" content="Fast, Secure Modern Website Experience">
          <meta property="og:description" content="Discover our ultra-fast and secure web application built with modern performance standards.">
          <meta property="og:image" content="https://example.com/og.png">
          <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-TEST123');
          </script>
        </head>
        <body>
          <header>
            <nav aria-label="Main Navigation">
              <a href="/">Home</a>
            </nav>
          </header>
          <main>
            <h1>Modern Web Standards</h1>
            <p>A full paragraph of real server-rendered text explaining the service to search engines and users.</p>
            <img src="/img1.jpg" alt="Description 1">
            <img src="/img2.jpg" alt="Description 2">
            <img src="/img3.jpg" alt="Description 3">
            <a href="tel:+15551234567">Call (555) 123-4567</a>
            <form>
              <label for="name">Name</label>
              <input id="name" type="text">
              <button type="submit" class="btn-primary">Get Started</button>
            </form>
            <section class="social-proof">
              <h2>Customer Reviews</h2>
              <p>Rated 5/5 stars by over 10,000 customers worldwide with proven case studies.</p>
            </section>
          </main>
          <footer>
            <p>© 2026</p>
          </footer>
        </body>
      </html>
    `;
    const headers = new Headers({
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
      "set-cookie": "session=abc; Secure; SameSite=Lax",
    });

    const result = runHtmlAndHeaderChecks({
      finalUrl: "https://example.com",
      html,
      headers,
      ttfbMs: 200,
    });

    expect(result.viewportPass).toBe(true);
    expect(result.pageMeta.title).toBe("Fast, Secure Modern Website Experience");
    expect(result.issues.length).toBe(0);
  });
});
